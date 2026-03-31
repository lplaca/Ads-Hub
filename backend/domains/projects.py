"""
Projects domain routes (CRUD + Notion/ClickUp integrations).
"""
import uuid
from fastapi import APIRouter, HTTPException
import requests as http_req
from backend.core.db import get_db
from backend.core.settings import get_setting
from backend.integrations.meta_client import fetch_meta_campaigns
from backend.services.sync_service import _parse_product_country

router = APIRouter()


@router.get("/api/projects")
def list_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at").fetchall()
    active = get_setting("active_project_id", "")
    conn.close()
    projects = [dict(r) for r in rows]
    for p in projects:
        p["is_active"] = (p["id"] == active)
    return projects


@router.post("/api/projects")
def create_project(data: dict):
    name  = data.get("name", "").strip()
    color = data.get("color", "#3b82f6")
    if not name:
        raise HTTPException(status_code=400, detail="Nome obrigatório")
    pid = str(uuid.uuid4())
    conn = get_db()
    conn.execute("INSERT INTO projects (id, name, color) VALUES (?,?,?)", (pid, name, color))
    # Auto-activate newly created project
    conn.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('active_project_id',?)", (pid,))
    conn.commit()
    conn.close()
    return {"id": pid, "name": name, "color": color, "is_active": True}


@router.put("/api/projects/{pid}")
def update_project(pid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    name  = data.get("name", row["name"])
    color = data.get("color", row["color"])
    conn.execute("UPDATE projects SET name=?, color=? WHERE id=?", (name, color, pid))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/api/projects/{pid}")
def delete_project(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/api/projects/{pid}/activate")
def activate_project(pid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    conn.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('active_project_id',?)", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True, "active_project_id": pid}


@router.get("/api/projects/active")
def get_active_project():
    active_id = get_setting("active_project_id", "")
    if not active_id:
        return {"id": "", "name": "Todos os projetos", "color": "#64748b"}
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (active_id,)).fetchone()
    conn.close()
    return dict(row) if row else {"id": "", "name": "Todos os projetos", "color": "#64748b"}


@router.get("/api/projects/{pid}/integrations")
def get_project_integrations(pid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    r = dict(row)
    return {
        "notion_token":          r.get("notion_token", "") or "",
        "notion_analyses_db_id": r.get("notion_analyses_db_id", "") or "",
        "notion_products_db_id": r.get("notion_products_db_id", "") or "",
        "clickup_token":         r.get("clickup_token", "") or "",
        "clickup_list_id":       r.get("clickup_list_id", "") or "",
    }


@router.put("/api/projects/{pid}/integrations")
def update_project_integrations(pid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT id FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    conn.execute(
        "UPDATE projects SET notion_token=?, notion_analyses_db_id=?, notion_products_db_id=?, clickup_token=?, clickup_list_id=? WHERE id=?",
        (
            data.get("notion_token", ""),
            data.get("notion_analyses_db_id", ""),
            data.get("notion_products_db_id", ""),
            data.get("clickup_token", ""),
            data.get("clickup_list_id", ""),
            pid,
        )
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/api/projects/{pid}/sync-notion")
def sync_project_notion(pid: str, data: dict):
    """Push a daily analysis row to this project's Notion Análises Diárias database."""
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    r = dict(row)
    token = r.get("notion_token", "") or ""
    db_id = r.get("notion_analyses_db_id", "") or ""
    if not token or not db_id:
        raise HTTPException(status_code=400, detail="Integração Notion não configurada para este projeto")

    props = {}
    if data.get("title"):
        props["Título"] = {"title": [{"text": {"content": str(data["title"])}}]}
    if data.get("date"):
        props["Data"] = {"date": {"start": str(data["date"])}}
    if data.get("periodo"):
        props["Período"] = {"select": {"name": str(data["periodo"])}}
    if data.get("gasto") is not None:
        props["Gasto"] = {"number": float(data["gasto"])}
    if data.get("vendas") is not None:
        props["Vendas"] = {"number": int(data["vendas"])}
    if data.get("cpa_real") is not None:
        props["CPA Real"] = {"number": float(data["cpa_real"])}
    if data.get("ctr") is not None:
        props["CTR%"] = {"number": float(data["ctr"])}
    if data.get("cliques") is not None:
        props["Cliques"] = {"number": int(data["cliques"])}
    if data.get("impressoes") is not None:
        props["Impressões"] = {"number": int(data["impressoes"])}
    if data.get("observacao"):
        props["Observação"] = {"rich_text": [{"text": {"content": str(data["observacao"])}}]}
    if data.get("acao_tomada"):
        props["Ação Tomada"] = {"rich_text": [{"text": {"content": str(data["acao_tomada"])}}]}

    try:
        resp = http_req.post(
            "https://api.notion.com/v1/pages",
            headers={
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            json={"parent": {"database_id": db_id}, "properties": props},
            timeout=15,
        )
        result = resp.json()
        if "id" in result:
            return {"ok": True, "notion_page_id": result["id"]}
        return {"ok": False, "error": result.get("message", "Erro ao criar página no Notion")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/projects/{pid}/pull-notion-products")
def pull_notion_products(pid: str):
    """Pull products from this project's Notion Produtos DB into ai_products (upsert by name)."""
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404)
    r = dict(row)
    token = r.get("notion_token", "") or ""
    db_id = r.get("notion_products_db_id", "") or ""
    if not token or not db_id:
        conn.close()
        raise HTTPException(status_code=400, detail="Notion Produtos não configurado neste projeto")
    try:
        resp = http_req.post(
            f"https://api.notion.com/v1/databases/{db_id}/query",
            headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"},
            json={"page_size": 100},
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    if "results" not in data:
        conn.close()
        return {"ok": False, "error": data.get("message", "Erro Notion"), "imported": 0}

    def _txt(props, *keys):
        for k in keys:
            p = props.get(k)
            if not p: continue
            t = p.get("type","")
            if t == "title":   return "".join(x["plain_text"] for x in p.get("title",[]))
            if t == "rich_text": return "".join(x["plain_text"] for x in p.get("rich_text",[]))
            if t == "select" and p.get("select"): return p["select"]["name"]
        return ""

    def _num(props, *keys):
        for k in keys:
            p = props.get(k)
            if p and p.get("type") == "number" and p.get("number") is not None:
                return float(p["number"])
        return 0.0

    imported = 0
    for page in data["results"]:
        props = page.get("properties", {})
        name = _txt(props, "Produto", "Nome", "Name")
        if not name: continue
        cpa   = _num(props, "CPA Alvo", "CPA Target")
        roas  = _num(props, "ROAS Alvo", "ROAS Target")
        ticket = _num(props, "Ticket Médio", "Ticket")
        notes_parts = [f"{k}: {_txt(props,k)}" for k in ["Status","Plataforma","CPA Máximo","Breakeven"] if _txt(props,k)]
        notes = " | ".join(notes_parts)
        existing = conn.execute("SELECT id FROM ai_products WHERE LOWER(name)=?", (name.lower(),)).fetchone()
        if existing:
            conn.execute("UPDATE ai_products SET cpa_target=?, roas_target=?, avg_ticket=?, notes=? WHERE id=?",
                         (cpa, roas, ticket, notes, existing["id"]))
        else:
            conn.execute("INSERT INTO ai_products (id,name,cpa_target,roas_target,avg_ticket,notes) VALUES (?,?,?,?,?,?)",
                         (str(uuid.uuid4()), name, cpa, roas, ticket, notes))
        imported += 1
    conn.commit()
    conn.close()
    return {"ok": True, "imported": imported}


@router.post("/api/projects/{pid}/pull-clickup-tasks")
def pull_clickup_tasks(pid: str):
    """Pull tasks from this project's ClickUp list into ai_ideas (insert new only)."""
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404)
    r = dict(row)
    token   = r.get("clickup_token", "") or ""
    list_id = r.get("clickup_list_id", "") or ""
    if not token or not list_id:
        conn.close()
        raise HTTPException(status_code=400, detail="ClickUp não configurado neste projeto")
    try:
        resp = http_req.get(
            f"https://api.clickup.com/api/v2/list/{list_id}/task",
            headers={"Authorization": token},
            params={"limit": 100},
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    if "tasks" not in data:
        conn.close()
        return {"ok": False, "error": data.get("err", "Erro ClickUp"), "imported": 0}

    STATUS_MAP = {"done":"approved","complete":"approved","closed":"approved",
                  "progress":"testing","doing":"testing","in progress":"testing",
                  "reject":"rejected","cancel":"rejected","recusado":"rejected"}
    imported = 0
    for task in data["tasks"]:
        title = task.get("name","")
        if not title: continue
        if conn.execute("SELECT id FROM ai_ideas WHERE title=?", (title,)).fetchone(): continue
        status_raw = ((task.get("status") or {}).get("status") or "").lower()
        status = next((v for k,v in STATUS_MAP.items() if k in status_raw), "new")
        desc = (task.get("description") or "")[:500]
        conn.execute("INSERT INTO ai_ideas (id,category,title,description,status,impact) VALUES (?,?,?,?,?,?)",
                     (str(uuid.uuid4()), "clickup", title, desc, status, "medium"))
        imported += 1
    conn.commit()
    conn.close()
    return {"ok": True, "imported": imported}


@router.post("/api/projects/{pid}/auto-products")
def auto_create_products(pid: str):
    """Scan campaign names for this project and auto-create ai_products per country."""
    conn = get_db()
    accounts = conn.execute("SELECT * FROM ad_accounts WHERE project_id=?", (pid,)).fetchall()
    if not accounts:
        conn.close()
        return {"ok": True, "created": 0, "message": "Nenhuma conta neste projeto"}
    created = 0
    seen: set = set()
    for acc in accounts:
        for c in fetch_meta_campaigns(acc["account_id"], acc["access_token"]):
            cname = c.get("name","")
            if not cname: continue
            pname, country = _parse_product_country(cname)
            if not pname: continue
            key = (pname.lower(), country or "")
            if key in seen: continue
            seen.add(key)
            if country:
                exists = conn.execute(
                    "SELECT id FROM ai_products WHERE LOWER(name)=? AND countries LIKE ?",
                    (pname.lower(), f"%{country}%")
                ).fetchone()
            else:
                exists = conn.execute("SELECT id FROM ai_products WHERE LOWER(name)=?", (pname.lower(),)).fetchone()
            if not exists:
                conn.execute(
                    "INSERT INTO ai_products (id,name,countries,notes) VALUES (?,?,?,?)",
                    (str(uuid.uuid4()), pname, country or "", f"Auto — campanha: {cname}")
                )
                created += 1
    conn.commit()
    conn.close()
    return {"ok": True, "created": created}


@router.get("/api/projects/{pid}/summary")
def project_summary(pid: str):
    """Resumo executivo completo do projeto para a página de detalhe."""
    from datetime import datetime
    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        raise HTTPException(404, "Projeto não encontrado")
    accounts = conn.execute(
        "SELECT * FROM ad_accounts WHERE project_id=? AND status='active'", (pid,)).fetchall()
    alerts_rows = conn.execute(
        "SELECT * FROM alerts WHERE project_id=? AND status='active' ORDER BY created_at DESC LIMIT 10", (pid,)).fetchall()
    try:
        tasks_rows = conn.execute(
            "SELECT * FROM tasks WHERE project_id=? AND status!='done' ORDER BY due_date ASC LIMIT 20", (pid,)).fetchall()
    except Exception:
        tasks_rows = []
    conn.close()
    return {
        "project": dict(project),
        "accounts": [dict(a) for a in accounts],
        "alerts": [dict(a) for a in alerts_rows],
        "tasks": [dict(t) for t in tasks_rows],
        "alert_count": len(alerts_rows),
        "task_count": len(tasks_rows),
        "account_count": len(accounts),
    }


@router.get("/api/projects/{pid}/health")
def project_health(pid: str):
    """Score de saúde do projeto baseado em alertas, sync, integração."""
    from datetime import datetime
    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not project:
        conn.close()
        raise HTTPException(404, "Projeto não encontrado")
    critical_alerts = conn.execute(
        "SELECT COUNT(*) FROM alerts WHERE project_id=? AND severity='critical' AND status='active'",
        (pid,)).fetchone()[0]
    warning_alerts = conn.execute(
        "SELECT COUNT(*) FROM alerts WHERE project_id=? AND severity='warning' AND status='active'",
        (pid,)).fetchone()[0]
    try:
        overdue_tasks = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE project_id=? AND status!='done' AND due_date < ? AND due_date != ''",
            (pid, datetime.now().date().isoformat())).fetchone()[0]
    except Exception:
        overdue_tasks = 0
    conn.close()
    score = max(0, min(100, 100 - critical_alerts * 20 - warning_alerts * 5 - overdue_tasks * 10))
    if score >= 80:
        status = "healthy"
    elif score >= 50:
        status = "warning"
    else:
        status = "critical"
    return {
        "score": score,
        "status": status,
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "overdue_tasks": overdue_tasks,
    }
