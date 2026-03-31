"""
Meta Graph API client functions.
"""
import requests as http_req
from backend.core.config import META_API

# ── Constants ─────────────────────────────────────────────────────────────────

CTA_MAP = {
    "SHOP_NOW": "SHOP_NOW", "COMPRAR": "SHOP_NOW",
    "LEARN_MORE": "LEARN_MORE", "SAIBA MAIS": "LEARN_MORE",
    "SIGN_UP": "SIGN_UP", "CADASTRE-SE": "SIGN_UP",
    "GET_OFFER": "GET_OFFER", "VER OFERTA": "GET_OFFER",
    "BUY_NOW": "BUY_NOW", "COMPRAR AGORA": "BUY_NOW",
    "BOOK_NOW": "BOOK_NOW", "AGENDAR": "BOOK_NOW",
}

COUNTRY_NAMES = {
    "BR": "Brazil", "US": "United States", "MX": "Mexico",
    "AR": "Argentina", "CL": "Chile", "CO": "Colombia",
    "PE": "Peru", "EC": "Ecuador", "UY": "Uruguay",
    "PY": "Paraguay", "BO": "Bolivia", "VE": "Venezuela",
    "ES": "Spain", "PT": "Portugal",
}


def meta_get(path: str, token: str, params: dict = None) -> dict:
    """Call Meta Graph API GET endpoint."""
    url = f"{META_API}/{path.lstrip('/')}"
    p = {"access_token": token, **(params or {})}
    try:
        r = http_req.get(url, params=p, timeout=15)
        data = r.json()
        if "error" in data:
            return {"error": data["error"]}
        return data
    except Exception as e:
        return {"error": str(e)}


def meta_post(path: str, token: str, payload: dict = None) -> dict:
    """Call Meta Graph API POST endpoint."""
    url = f"{META_API}/{path.lstrip('/')}"
    try:
        r = http_req.post(url, data={"access_token": token, **(payload or {})}, timeout=15)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def meta_post_json(path: str, token: str, payload: dict = None) -> dict:
    """Call Meta Graph API POST with JSON body (needed for targeting objects)."""
    url = f"{META_API}/{path.lstrip('/')}"
    try:
        p = payload or {}
        p["access_token"] = token
        r = http_req.post(url, json=p, timeout=30)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def fetch_meta_campaigns(account_id: str, token: str) -> list:
    """Fetch real campaigns from Meta API for an ad account."""
    clean_id = account_id.replace("act_", "")
    data = meta_get(
        f"act_{clean_id}/campaigns",
        token,
        {"fields": "id,name,status,daily_budget,lifetime_budget,objective", "limit": 200}
    )
    if "error" in data:
        return []
    return data.get("data", [])


def fetch_meta_insights(campaign_id: str, token: str, date_preset: str = "last_7d") -> dict:
    """Fetch campaign insights from Meta API — full metric set."""
    from backend.domains.accounts import _META_INSIGHT_FIELDS, _parse_campaign_insights
    data = meta_get(
        f"{campaign_id}/insights",
        token,
        {"fields": _META_INSIGHT_FIELDS, "date_preset": date_preset}
    )
    if "error" in data or not data.get("data"):
        return {}
    return _parse_campaign_insights(data["data"][0])


def pause_meta_campaign(campaign_id: str, token: str) -> bool:
    """Pause a campaign on Meta."""
    r = meta_post(campaign_id, token, {"status": "PAUSED"})
    return "error" not in r


def activate_meta_campaign(campaign_id: str, token: str) -> bool:
    """Activate a campaign on Meta."""
    r = meta_post(campaign_id, token, {"status": "ACTIVE"})
    return "error" not in r


def verify_meta_token(token: str, bm_id: str = "") -> dict:
    """Verify a Meta access token."""
    r = meta_get("me", token, {"fields": "id,name"})
    if "error" in r:
        return {"valid": False, "error": r["error"]}
    return {"valid": True, "name": r.get("name", ""), "id": r.get("id", "")}


def fetch_bm_ad_accounts(bm_id: str, token: str) -> list:
    """Fetch all ad accounts linked to a BM (owned + client), deduplicated."""
    accounts = []
    for endpoint in [f"{bm_id}/owned_ad_accounts", f"{bm_id}/client_ad_accounts"]:
        data = meta_get(endpoint, token, {"fields": "id,name,account_status,currency,timezone_name", "limit": 200})
        if "data" in data:
            accounts += data["data"]
    seen, unique = set(), []
    for a in accounts:
        if a.get("id") and a["id"] not in seen:
            seen.add(a["id"])
            unique.append(a)
    return unique
