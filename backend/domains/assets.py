"""
Assets domain: connected Meta assets summary (BMs, Ad Accounts, Pages).
"""
from fastapi import APIRouter, Query, HTTPException
from backend.core.db import get_db
from backend.integrations.meta_client import meta_get

router = APIRouter()


@router.get("/api/assets/summary")
def get_assets_summary(token: str = Query(...)):
    """
    Calls Meta Graph API and returns BMs, Ad Accounts, Pages and token owner
    in a single response.
    """
    # Validate token and get owner info
    owner = meta_get("me", token, {"fields": "id,name"})
    if "error" in owner:
        err = owner["error"]
        msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
        raise HTTPException(status_code=400, detail=f"Token inválido: {msg}")

    # Business Managers
    bm_data = meta_get("me/businesses", token, {"fields": "id,name,created_time", "limit": 100})
    business_managers = bm_data.get("data", []) if "data" in bm_data else []

    # Ad Accounts
    acc_data = meta_get(
        "me/adaccounts", token,
        {"fields": "id,name,account_status,currency,timezone_name", "limit": 200}
    )
    ad_accounts = acc_data.get("data", []) if "data" in acc_data else []

    # Pages
    pages_data = meta_get(
        "me/accounts", token,
        {"fields": "id,name,category,fan_count,access_token", "limit": 200}
    )
    pages = pages_data.get("data", []) if "data" in pages_data else []

    return {
        "business_managers": business_managers,
        "ad_accounts": ad_accounts,
        "pages": pages,
        "token_owner": {
            "id": owner.get("id", ""),
            "name": owner.get("name", ""),
        },
    }


@router.get("/api/assets/tokens")
def get_assets_tokens():
    """
    Lists all unique tokens saved in sheets_accounts, grouped by config_id.
    Returns config_id, access_token, ad_account_id and page_id for each.
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT config_id, access_token, ad_account_id, page_id FROM sheets_accounts"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
