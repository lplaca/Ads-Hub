"""
Campaigns domain routes.
"""
from typing import Optional
from fastapi import APIRouter
from backend.core.db import get_db
from backend.core.settings import _get_active_accounts
from backend.integrations.meta_client import fetch_meta_campaigns, fetch_meta_insights, pause_meta_campaign, activate_meta_campaign
from backend.domains.accounts import _EMPTY_METRICS

router = APIRouter()


@router.get("/api/campaigns")
def list_campaigns(status: Optional[str] = None, period: str = "last_7d"):
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return []
    # Real accounts: fetch from Meta
    all_campaigns = []
    for acc in accounts:
        acc_d = dict(acc)
        meta_camps = fetch_meta_campaigns(acc_d["account_id"], acc_d["access_token"])
        for mc in meta_camps:
            ins = fetch_meta_insights(mc["id"], acc_d["access_token"], period)
            camp = {
                "id":           mc["id"],
                "name":         mc["name"],
                "account":      acc_d["name"],
                "account_id":   acc_d["id"],
                "country":      acc_d.get("country", ""),
                "status":       mc["status"].lower(),
                # all metrics from parser
                **{k: ins.get(k, 0) for k in _EMPTY_METRICS},
            }
            if not status or camp["status"] == status:
                all_campaigns.append(camp)
    return all_campaigns


@router.post("/api/campaigns/{cid}/pause")
def pause_campaign(cid: str):
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": "Campanha pausada! (modo demo)"}
    # Try to pause on Meta API
    for acc in accounts:
        token = dict(acc)["access_token"]
        if pause_meta_campaign(cid, token):
            return {"status": "success", "message": "Campanha pausada no Meta com sucesso!"}
    return {"status": "error", "message": "Não foi possível pausar a campanha."}


@router.post("/api/campaigns/{cid}/activate")
def activate_campaign(cid: str):
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": "Campanha ativada! (modo demo)"}
    for acc in accounts:
        token = dict(acc)["access_token"]
        if activate_meta_campaign(cid, token):
            return {"status": "success", "message": "Campanha ativada no Meta com sucesso!"}
    return {"status": "error", "message": "Não foi possível ativar a campanha."}


@router.post("/api/campaigns/bulk-pause")
def bulk_pause(data: dict):
    ids = data.get("ids", [])
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": f"{len(ids)} campanha(s) pausada(s)! (modo demo)"}
    success = 0
    for cid in ids:
        for acc in accounts:
            if pause_meta_campaign(cid, dict(acc)["access_token"]):
                success += 1
                break
    return {"status": "success", "message": f"{success}/{len(ids)} campanha(s) pausada(s) no Meta!"}


@router.post("/api/campaigns/bulk-activate")
def bulk_activate(data: dict):
    ids = data.get("ids", [])
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": f"{len(ids)} campanha(s) ativada(s)! (modo demo)"}
    success = 0
    for cid in ids:
        for acc in accounts:
            if activate_meta_campaign(cid, dict(acc)["access_token"]):
                success += 1
                break
    return {"status": "success", "message": f"{success}/{len(ids)} campanha(s) ativada(s) no Meta!"}
