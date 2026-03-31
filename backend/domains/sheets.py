"""
Google Sheets config, imported products, and sheets-accounts routes.
"""
import json, uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db
from backend.integrations.sheets_client import sync_sheets_to_db

router = APIRouter()


@router.get("/api/sheets/config")
def get_sheets_config():
    conn = get_db()
    row = conn.execute("SELECT * FROM sheets_config LIMIT 1").fetchone()
    conn.close()
    if not row:
        return {"configured": False}
    d = dict(row)
    d["service_account_json"] = "set" if d.get("service_account_json") else ""
    return {"configured": True, **d}


@router.post("/api/sheets/config")
def save_sheets_config(data: dict):
    spreadsheet_id = data.get("spreadsheet_id", "").strip()
    service_account_json = data.get("service_account_json", "").strip()
    config_tab = data.get("config_tab", "Configurações")
    ads_tab = data.get("ads_tab", "Anúncios")
    if not spreadsheet_id or not service_account_json:
        raise HTTPException(400, "spreadsheet_id e service_account_json são obrigatórios")
    try:
        json.loads(service_account_json)
    except Exception:
        raise HTTPException(400, "service_account_json inválido — deve ser o JSON completo da conta de serviço")
    conn = get_db()
    existing = conn.execute("SELECT id FROM sheets_config LIMIT 1").fetchone()
    if existing:
        conn.execute("UPDATE sheets_config SET spreadsheet_id=?, service_account_json=?, config_tab=?, ads_tab=? WHERE id=?",
                     (spreadsheet_id, service_account_json, config_tab, ads_tab, existing["id"]))
    else:
        conn.execute("INSERT INTO sheets_config (id, spreadsheet_id, service_account_json, config_tab, ads_tab) VALUES (?, ?, ?, ?, ?)",
                     (str(uuid.uuid4()), spreadsheet_id, service_account_json, config_tab, ads_tab))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.post("/api/sheets/sync")
def run_sheets_sync():
    conn = get_db()
    row = conn.execute("SELECT * FROM sheets_config LIMIT 1").fetchone()
    conn.close()
    if not row:
        raise HTTPException(400, "Configuração do Google Sheets não encontrada. Configure primeiro.")
    config = dict(row)
    try:
        result = sync_sheets_to_db(config)
        conn2 = get_db()
        conn2.execute("UPDATE sheets_config SET last_synced_at=?, sync_status='ok', rows_synced=? WHERE id=?",
                      (datetime.now().isoformat(), result["synced_products"], config["id"]))
        conn2.commit()
        conn2.close()
        return {"status": "success", **result}
    except Exception as ex:
        conn2 = get_db()
        conn2.execute("UPDATE sheets_config SET sync_status='error' WHERE id=?", (config["id"],))
        conn2.commit()
        conn2.close()
        raise HTTPException(500, str(ex))


@router.get("/api/imported-products")
def list_imported_products(launch_status: Optional[str] = None):
    conn = get_db()
    q = "SELECT * FROM imported_products"
    params = []
    if launch_status:
        q += " WHERE launch_status=?"
        params.append(launch_status)
    q += " ORDER BY created_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["urls_videos"] = json.loads(d.get("urls_videos", "[]"))
        d["paises"] = json.loads(d.get("paises", "[]"))
        d["video_count"] = len(d["urls_videos"])
        result.append(d)
    return result


@router.get("/api/imported-products/{pid}")
def get_imported_product(pid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM imported_products WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Produto não encontrado")
    d = dict(row)
    d["urls_videos"] = json.loads(d.get("urls_videos", "[]"))
    d["paises"] = json.loads(d.get("paises", "[]"))
    return d


@router.delete("/api/imported-products/{pid}")
def delete_imported_product(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM imported_products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.get("/api/sheets-accounts")
def list_sheets_accounts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sheets_accounts ORDER BY config_id").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["access_token"] = "***"
        d["app_secret"] = "***"
        result.append(d)
    return result
