"""
Business Managers domain routes.
"""
import uuid
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db
from backend.core.settings import get_setting
from backend.integrations.meta_client import verify_meta_token
from backend.services.sync_service import _sync_bm_accounts

router = APIRouter()


@router.get("/api/bm")
def list_bms(project_id: str = ""):
    conn = get_db()
    active_project = project_id or get_setting("active_project_id", "")
    if active_project:
        rows = conn.execute("SELECT * FROM business_managers WHERE project_id=?", (active_project,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM business_managers").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["access_token"] = "***"
        result.append(d)
    return result


@router.post("/api/bm")
def add_bm(data: dict):
    conn = get_db()
    bid = str(uuid.uuid4())
    project_id = data.get("project_id") or get_setting("active_project_id", "")
    conn.execute(
        "INSERT INTO business_managers (id, name, bm_id, access_token, project_id) VALUES (?,?,?,?,?)",
        (bid, data["name"], data["bm_id"], data["access_token"], project_id),
    )
    # Auto-sync ad accounts linked to this BM (inherit project_id)
    imported = 0
    try:
        imported = _sync_bm_accounts(bid, data["bm_id"], data["access_token"], conn, project_id)
    except Exception:
        pass
    conn.commit()
    conn.close()
    msg = f"BM adicionado com sucesso!"
    if imported > 0:
        msg = f"BM adicionado! {imported} conta(s) de anúncio importada(s) automaticamente."
    return {"id": bid, "status": "success", "message": msg, "accounts_imported": imported}


@router.post("/api/bm/{bm_id}/sync-accounts")
def sync_bm_accounts(bm_id: str):
    """Manually re-sync all ad accounts for a BM."""
    conn = get_db()
    row = conn.execute("SELECT * FROM business_managers WHERE id=?", (bm_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "BM não encontrado")
    d = dict(row)
    imported = 0
    try:
        imported = _sync_bm_accounts(bm_id, d["bm_id"], d["access_token"], conn, d.get("project_id", ""))
    except Exception as e:
        conn.close()
        raise HTTPException(500, str(e))
    conn.commit()
    conn.close()
    return {"status": "success", "accounts_imported": imported, "message": f"{imported} conta(s) sincronizada(s)."}


@router.put("/api/bm/{bm_id}")
def update_bm(bm_id: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE business_managers SET name=?, bm_id=?, status='connected' WHERE id=?",
        (data.get("name"), data.get("bm_id"), bm_id),
    )
    if data.get("access_token"):
        conn.execute("UPDATE business_managers SET access_token=? WHERE id=?", (data["access_token"], bm_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.delete("/api/bm/{bm_id}")
def delete_bm(bm_id: str):
    conn = get_db()
    conn.execute("DELETE FROM business_managers WHERE id=?", (bm_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.post("/api/bm/test")
def test_bm_connection(data: dict):
    token = data.get("access_token", "")
    if not token or token == "***":
        return {"status": "error", "message": "Token não fornecido."}
    result = verify_meta_token(token, data.get("bm_id", ""))
    if result["valid"]:
        return {"status": "success", "message": f"Conectado como: {result.get('name', 'OK')}"}
    return {"status": "error", "message": "Token inválido. Verifique o access token."}
