"""
API Connections and Live Poll routes.
"""
import json, uuid
from fastapi import APIRouter
from backend.core.db import get_db
from backend.core.settings import _get_active_accounts
from backend.integrations.meta_client import meta_get, fetch_meta_campaigns
from backend.domains.accounts import _EMPTY_METRICS, _fetch_account_insights

router = APIRouter()

ALL_CAPS = ["identity", "campaigns_read", "insights_read", "campaigns_pause", "campaigns_activate", "budget_edit", "campaigns_create"]
READ_CAPS = ["identity", "campaigns_read", "insights_read"]
FULL_CAPS = ALL_CAPS[:]


def _build_caps(token: str, account_id: str, token_type: str) -> tuple:
    """Verify token and return (user_name, user_id, capabilities_list)."""
    if token.startswith("demo") or token.startswith("test"):
        caps = READ_CAPS if token_type == "readonly" else FULL_CAPS
        return "Demo User", "demo_001", caps
    me = meta_get("me", token, {"fields": "id,name"})
    if "error" in me:
        return None, None, []
    user_name = me.get("name", "")
    user_id = me.get("id", "")
    caps = ["identity"]
    if account_id:
        camps = fetch_meta_campaigns(account_id, token)
        if isinstance(camps, list):
            caps += ["campaigns_read", "insights_read"]
    else:
        caps += ["campaigns_read", "insights_read"]
    if token_type == "full":
        caps += ["campaigns_pause", "campaigns_activate", "budget_edit", "campaigns_create"]
    return user_name, user_id, caps


@router.get("/api/connections")
def list_connections():
    conn = get_db()
    rows = conn.execute("SELECT * FROM api_connections ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        tok = d.get("token", "")
        d["token_masked"] = (tok[:6] + "..." + tok[-4:]) if len(tok) > 10 else "****"
        del d["token"]
        result.append(d)
    return result


@router.post("/api/connections/verify")
def verify_connection(data: dict):
    token = data.get("token", "")
    account_id = data.get("account_id", "")
    token_type = data.get("token_type", "full")
    if not token:
        return {"valid": False, "message": "Token não fornecido."}
    user_name, user_id, caps = _build_caps(token, account_id, token_type)
    if user_name is None:
        return {"valid": False, "message": "Token inválido. Verifique o access token Meta."}
    return {
        "valid": True,
        "user_name": user_name,
        "user_id": user_id,
        "capabilities": caps,
        "message": f"Conectado como {user_name}!"
    }


@router.post("/api/connections")
def add_connection(data: dict):
    from fastapi import HTTPException
    token = data.get("token", "")
    if not token or not data.get("name"):
        raise HTTPException(400, "name e token são obrigatórios")
    verified = data.get("verified_data") or {}
    user_name = verified.get("user_name", "")
    user_id = verified.get("user_id", "")
    caps = verified.get("capabilities", [])
    if not caps:
        u, uid, caps = _build_caps(token, data.get("account_id", ""), data.get("token_type", "full"))
        user_name = u or ""
        user_id = uid or ""
    cid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO api_connections (id, name, token, token_type, account_id, bm_id, user_name, user_id, capabilities) VALUES (?,?,?,?,?,?,?,?,?)",
        (cid, data["name"], token, data.get("token_type", "full"),
         data.get("account_id", ""), data.get("bm_id", ""),
         user_name, user_id, json.dumps(caps))
    )
    conn.commit()
    conn.close()
    return {"id": cid, "status": "success", "message": "Conexão adicionada com sucesso!"}


@router.delete("/api/connections/{conn_id}")
def delete_connection(conn_id: str):
    conn = get_db()
    conn.execute("DELETE FROM api_connections WHERE id=?", (conn_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.get("/api/connections/capabilities")
def get_aggregate_capabilities():
    """Returns aggregate of all capabilities across all connections."""
    conn = get_db()
    rows = conn.execute("SELECT capabilities, token_type FROM api_connections WHERE status='active'").fetchall()
    conn.close()
    caps = set()
    has_full = False
    has_readonly = False
    for r in rows:
        arr = json.loads(r["capabilities"] or "[]")
        for c in arr:
            caps.add(c)
        if r["token_type"] == "full":
            has_full = True
        else:
            has_readonly = True
    return {
        "capabilities": list(caps),
        "has_full_access": has_full,
        "has_readonly": has_readonly,
        "connection_count": len(rows)
    }


@router.get("/api/live")
def live_summary(period: str = "today"):
    """Lightweight live poll: returns aggregated totals for all accounts.
    Called by the frontend every N seconds to keep metrics fresh."""
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    totals = dict(_EMPTY_METRICS)
    account_data = []
    for acc in accounts:
        a = dict(acc)
        m = _fetch_account_insights(a["account_id"], a["access_token"], period)
        account_data.append({"id": a["id"], "name": a["name"], **m})
        for k in _EMPTY_METRICS:
            totals[k] = round(totals[k] + m.get(k, 0), 4)
    from datetime import datetime
    return {
        "updated_at": datetime.now().isoformat(),
        "period": period,
        "totals": totals,
        "accounts": account_data,
    }


@router.get("/api/health")
def integrations_health():
    """Health status de todas as integrações configuradas."""
    from backend.services.health_service import get_all_integrations_health
    return get_all_integrations_health()


@router.get("/api/integrations/clickup/workspaces")
def clickup_workspaces():
    from backend.core.settings import get_setting
    from backend.integrations.clickup_client import get_workspaces
    token = get_setting("clickup_token", "")
    if not token:
        from fastapi import HTTPException
        raise HTTPException(400, "Token ClickUp não configurado")
    return get_workspaces(token)


@router.get("/api/integrations/clickup/lists/{space_id}")
def clickup_lists(space_id: str):
    from backend.core.settings import get_setting
    from backend.integrations.clickup_client import get_lists
    token = get_setting("clickup_token", "")
    return get_lists(space_id, token)


@router.post("/api/integrations/clickup/create-task")
def clickup_create_task(data: dict):
    from backend.core.settings import get_setting
    from backend.integrations.clickup_client import create_task
    from fastapi import HTTPException
    token = get_setting("clickup_token", "")
    if not token:
        raise HTTPException(400, "Token ClickUp não configurado")
    list_id = data.get("list_id") or get_setting("clickup_default_list_id", "")
    if not list_id:
        raise HTTPException(400, "list_id obrigatório")
    return create_task(list_id, token, data.get("title", ""), data.get("description", ""))
