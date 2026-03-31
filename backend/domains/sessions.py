"""
Work Sessions domain routes (ClickUp/Notion sync).
"""
import json, uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
import requests as http_req
from backend.core.db import get_db
from backend.core.settings import _get_active_accounts
from backend.services.sync_service import _take_campaign_snapshot, _compute_session_diff
from backend.domains.accounts import _fetch_account_insights

router = APIRouter()


@router.post("/api/sessions/start")
def session_start():
    conn = get_db()
    conn.execute("UPDATE work_sessions SET status='abandoned' WHERE status='active'")
    conn.commit()
    conn.close()
    snapshot = _take_campaign_snapshot()
    sid = str(uuid.uuid4())
    now = datetime.now().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO work_sessions (id, started_at, snapshot_before, status) VALUES (?,?,?,?)",
        (sid, now, json.dumps(snapshot), "active")
    )
    conn.commit()
    conn.close()
    return {
        "id": sid, "started_at": now,
        "accounts": len(snapshot),
        "campaigns": sum(len(a.get("campaigns", {})) for a in snapshot.values())
    }


@router.get("/api/sessions/active")
def session_get_active():
    conn = get_db()
    row = conn.execute(
        "SELECT id, started_at FROM work_sessions WHERE status='active' ORDER BY started_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if not row:
        return {"active": False}
    d = dict(row)
    return {"active": True, "id": d["id"], "started_at": d["started_at"]}


@router.post("/api/sessions/{sid}/finish")
def session_finish(sid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM work_sessions WHERE id=?", (sid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    before = json.loads(dict(row)["snapshot_before"] or "{}")
    after = _take_campaign_snapshot()
    diff = _compute_session_diff(before, after)
    now = datetime.now().isoformat()
    conn.execute(
        "UPDATE work_sessions SET snapshot_after=?, diff=?, status='finished', finished_at=? WHERE id=?",
        (json.dumps(after), json.dumps(diff), now, sid)
    )
    conn.commit()
    conn.close()
    # Also fetch current metrics for all accounts
    metrics = {}
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    for acc in accounts:
        acc_d = dict(acc)
        try:
            m = _fetch_account_insights(acc_d["account_id"], acc_d["access_token"], "today")
            metrics[acc_d["id"]] = {"name": acc_d["name"], "country": acc_d.get("country", ""), "metrics": m}
        except Exception:
            pass
    return {"id": sid, "finished_at": now, "diff": diff, "metrics": metrics}


@router.get("/api/sessions/notion-products")
def notion_get_products():
    conn = get_db()
    rows = conn.execute(
        "SELECT key, value FROM settings WHERE key IN ('notion_token','notion_products_db_id')"
    ).fetchall()
    conn.close()
    s = {r["key"]: r["value"] for r in rows}
    token, db_id = s.get("notion_token", ""), s.get("notion_products_db_id", "")
    if not token or not db_id:
        return []
    try:
        r = http_req.post(
            f"https://api.notion.com/v1/databases/{db_id}/query",
            headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28",
                     "Content-Type": "application/json"},
            json={"sorts": [{"property": "Produto", "direction": "ascending"}]},
            timeout=15
        )
        products = []
        for p in r.json().get("results", []):
            props = p.get("properties", {})
            title_arr = props.get("Produto", {}).get("title", [])
            name = title_arr[0]["text"]["content"] if title_arr else ""
            status = (props.get("Status", {}).get("select") or {}).get("name", "")
            products.append({"id": p["id"], "name": name, "status": status})
        return products
    except Exception as e:
        return {"error": str(e)}


# publish endpoint matching SyncPage frontend format
@router.post("/api/sessions/{sid}/publish")
def session_publish_v2(sid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT * FROM work_sessions WHERE id=?", (sid,)).fetchone()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    s = {r["key"]: r["value"] for r in settings_rows}
    to_clickup   = data.get("to_clickup", False)
    to_notion    = data.get("to_notion", False)
    products_data= data.get("products_data", {})   # {product_id: {name, spend, vendas, period, acao, obs}}
    diff_summary = data.get("diff_summary", "")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    results = []

    # ── ClickUp ──────────────────────────────────────────────────────────────
    if to_clickup:
        ck_key  = s.get("clickup_api_key", "")
        ck_list = s.get("clickup_list_id", "901322010985")
        if ck_key:
            lines = [f"Meta Ads Update — {now_str}", "", diff_summary, ""]
            for pid, pd in products_data.items():
                lines.append(f"• {pd.get('name','')}: ${float(pd.get('spend',0) or 0):.2f} gasto | {pd.get('vendas',0)} vendas")
                if pd.get("acao"): lines.append(f"  Ação: {pd['acao']}")
                if pd.get("obs"):  lines.append(f"  Obs: {pd['obs']}")
            title = f"Meta Ads — {datetime.now().strftime('%d/%m/%Y')}"
            try:
                r = http_req.post(
                    f"https://api.clickup.com/api/v2/list/{ck_list}/task",
                    headers={"Authorization": ck_key, "Content-Type": "application/json"},
                    json={"name": title, "description": "\n".join(lines)},
                    timeout=15
                )
                rj = r.json()
                results.append({"target":"ClickUp","label":title,"ok": r.status_code < 300,"url": rj.get("url",""),"error": rj.get("err","")})
            except Exception as e:
                results.append({"target":"ClickUp","ok":False,"error":str(e)})
        else:
            results.append({"target":"ClickUp","ok":False,"error":"API key não configurada"})

    # ── Notion ────────────────────────────────────────────────────────────────
    if to_notion:
        notion_token = s.get("notion_token", "")
        notion_db    = s.get("notion_db_id", "")
        today = datetime.now().strftime("%Y-%m-%d")
        if notion_token and notion_db:
            for pid, pd in products_data.items():
                period_val = pd.get("period", "Tarde")
                props = {
                    "Título": {"title": [{"text": {"content": f"{pd.get('name','')} — {today}"}}]},
                    "Data":   {"date": {"start": today}},
                    "Período":{"select": {"name": period_val}},
                    "Gasto (ad spend)": {"number": float(pd.get("spend", 0) or 0)},
                    "Vendas": {"number": int(float(pd.get("vendas", 0) or 0))},
                    "Ação tomada": {"rich_text": [{"text": {"content": pd.get("acao","")}}]},
                    "Observação": {"rich_text": [{"text": {"content": pd.get("obs","")}}]},
                }
                try:
                    r = http_req.post(
                        "https://api.notion.com/v1/pages",
                        headers={"Authorization": f"Bearer {notion_token}",
                                 "Notion-Version": "2022-06-28",
                                 "Content-Type": "application/json"},
                        json={"parent": {"database_id": notion_db}, "properties": props},
                        timeout=15
                    )
                    rj = r.json()
                    results.append({"target":"Notion","label":pd.get("name",""),"ok": r.status_code < 300,"url": rj.get("url","")})
                except Exception as e:
                    results.append({"target":"Notion","label":pd.get("name",""),"ok":False,"error":str(e)})
        else:
            results.append({"target":"Notion","ok":False,"error":"Notion não configurado"})

    conn2 = get_db()
    conn2.execute("UPDATE work_sessions SET status='synced' WHERE id=?", (sid,))
    conn2.commit()
    conn2.close()
    return {"ok": True, "results": results}
