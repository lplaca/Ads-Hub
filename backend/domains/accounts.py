"""
Ad Accounts domain routes and insight helpers.
"""
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db
from backend.core.settings import get_setting, _get_active_accounts
from backend.integrations.meta_client import meta_get, fetch_meta_campaigns, verify_meta_token

router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────────

_EMPTY_METRICS = {
    "spend": 0, "revenue": 0, "impressions": 0, "reach": 0,
    "clicks": 0, "link_clicks": 0, "ctr": 0,
    "connect_rate": 0, "lp_view_rate": 0, "checkout_per_lpv": 0, "purchase_per_ic": 0,
    "cpc_link": 0, "cost_per_lp": 0, "cpa": 0, "cost_per_checkout": 0,
    "lpv": 0, "checkouts": 0, "conversions": 0,
    "video_3s": 0, "video_thru": 0, "roas": 0,
}

# ── Full metrics field string for Meta Graph API ─────────────────────────────
_META_INSIGHT_FIELDS = (
    "spend,impressions,reach,"
    "clicks,inline_link_clicks,outbound_clicks,"
    "ctr,cost_per_inline_link_click,"
    "actions,action_values,cost_per_action_type,"
    "video_3_sec_watched_actions,video_thruplay_watched_actions"
)

_PURCHASE_TYPES   = {"purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"}
_CHECKOUT_TYPES   = {"initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"}
_LPV_TYPES        = {"landing_page_view"}
_VIDEO3S_TYPES    = {"video_view"}  # 3-second views come from video_3_sec_watched_actions
_OUTBOUND_TYPES   = {"outbound_click"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _insights_field(period: str, date_from: str = "", date_to: str = "", metrics: str = "spend,impressions,clicks,ctr,actions,action_values") -> str:
    """Build the Meta API inline insights field string for a period or custom range."""
    if period == "custom" and date_from and date_to:
        return f'insights.time_range({{"since":"{date_from}","until":"{date_to}"}}){{{metrics}}}'
    return f"insights.date_preset({period}){{{metrics}}}"


def _insights_params(period: str, date_from: str = "", date_to: str = "") -> dict:
    """Build query params for a standalone /insights call (not inline)."""
    fields = _META_INSIGHT_FIELDS
    if period == "custom" and date_from and date_to:
        return {"fields": fields, "time_range": json.dumps({"since": date_from, "until": date_to})}
    return {"fields": fields, "date_preset": period}


def _parse_campaign_insights(ins: dict) -> dict:
    """Parse a Meta API insights dict into all key metrics."""
    spend       = float(ins.get("spend", 0))
    impressions = int(ins.get("impressions", 0))
    reach       = int(ins.get("reach", 0))
    clicks      = int(ins.get("clicks", 0))
    link_clicks = int(ins.get("inline_link_clicks", 0))
    ctr         = float(ins.get("ctr", 0))
    cpc_link    = float(ins.get("cost_per_inline_link_click", 0))

    conversions  = 0
    checkouts    = 0
    lpv          = 0      # landing page views
    revenue      = 0.0
    video_3s     = 0      # 3-second video views (connect rate numerator)
    video_thru   = 0      # ThruPlay views

    # Parse actions array
    for a in ins.get("actions", []):
        t   = a.get("action_type", "")
        val = int(float(a.get("value", 0)))
        if t in _PURCHASE_TYPES:   conversions += val
        if t in _CHECKOUT_TYPES:   checkouts   += val
        if t in _LPV_TYPES:        lpv         += val

    # Parse action_values (revenue)
    for av in ins.get("action_values", []):
        if av.get("action_type", "") in _PURCHASE_TYPES:
            revenue += float(av.get("value", 0))

    # video_3_sec_watched_actions is a list like [{"action_type":"video_view","value":"123"}]
    for v in ins.get("video_3_sec_watched_actions", []):
        video_3s += int(float(v.get("value", 0)))
    for v in ins.get("video_thruplay_watched_actions", []):
        video_thru += int(float(v.get("value", 0)))

    # ── Derived metrics ───────────────────────────────────────────────────────
    roas        = round(revenue / spend, 2)          if spend > 0 else 0
    cpa         = round(spend / conversions, 2)       if conversions > 0 else 0
    cost_per_co = round(spend / checkouts, 2)         if checkouts > 0 else 0
    cost_per_lp = round(spend / lpv, 2)               if lpv > 0 else 0
    # Connect Rate: 3-sec video views / impressions (or reach for stricter def)
    connect_rate      = round(video_3s / impressions * 100, 2) if impressions > 0 else 0
    # LP View Rate: landing_page_views / link_clicks
    lp_view_rate      = round(lpv / link_clicks * 100, 2)      if link_clicks > 0 else 0
    # Checkout rate per LP view
    checkout_per_lpv  = round(checkouts / lpv * 100, 2)         if lpv > 0 else 0
    # Purchase rate per IC (initiate checkout → purchase)
    purchase_per_ic   = round(conversions / checkouts * 100, 2) if checkouts > 0 else 0

    return {
        # spend / scale
        "spend":             spend,
        "revenue":           round(revenue, 2),
        # reach & impressions
        "impressions":       impressions,
        "reach":             reach,
        # clicks
        "clicks":            clicks,
        "link_clicks":       link_clicks,
        # rates
        "ctr":               round(ctr, 2),
        "connect_rate":      connect_rate,
        "lp_view_rate":      lp_view_rate,
        "checkout_per_lpv":  checkout_per_lpv,
        "purchase_per_ic":   purchase_per_ic,
        # costs
        "cpc_link":          round(cpc_link, 2),
        "cost_per_lp":       cost_per_lp,
        "cpa":               cpa,
        "cost_per_checkout": cost_per_co,
        # funnel volumes
        "lpv":               lpv,
        "checkouts":         checkouts,
        "conversions":       conversions,
        # video
        "video_3s":          video_3s,
        "video_thru":        video_thru,
        # composite
        "roas":              roas,
    }


def _fetch_account_insights(account_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch aggregated account-level insights from Meta API."""
    params = _insights_params(period, date_from, date_to)
    data = meta_get(f"{account_id}/insights", token, params)
    rows = data.get("data", [])
    return _parse_campaign_insights(rows[0]) if rows else dict(_EMPTY_METRICS)


def _fetch_campaign_insights_breakdown(account_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch per-campaign insights breakdown from account. Returns {campaign_id: metrics_dict}."""
    params = _insights_params(period, date_from, date_to)
    params["level"] = "campaign"
    params["fields"] = "campaign_id," + _META_INSIGHT_FIELDS
    data = meta_get(f"{account_id}/insights", token, params)
    result = {}
    for row in data.get("data", []):
        cid = row.get("campaign_id")
        if cid:
            result[cid] = _parse_campaign_insights(row)
    return result


def _fetch_adset_insights_breakdown(campaign_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch per-adset insights breakdown from campaign. Returns {adset_id: metrics_dict}."""
    params = _insights_params(period, date_from, date_to)
    params["level"] = "adset"
    params["fields"] = "adset_id," + _META_INSIGHT_FIELDS
    data = meta_get(f"{campaign_id}/insights", token, params)
    result = {}
    for row in data.get("data", []):
        sid = row.get("adset_id")
        if sid:
            result[sid] = _parse_campaign_insights(row)
    return result


def _fetch_ad_insights_breakdown(adset_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch per-ad insights breakdown from adset. Returns {ad_id: metrics_dict}."""
    params = _insights_params(period, date_from, date_to)
    params["level"] = "ad"
    params["fields"] = "ad_id," + _META_INSIGHT_FIELDS
    data = meta_get(f"{adset_id}/insights", token, params)
    result = {}
    for row in data.get("data", []):
        aid = row.get("ad_id")
        if aid:
            result[aid] = _parse_campaign_insights(row)
    return result


def _fetch_demographic_insights(account_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> list:
    """Fetch age+gender demographic breakdown from Meta API. Returns list of {age, gender, ...metrics}."""
    params = _insights_params(period, date_from, date_to)
    params["breakdowns"] = "age,gender"
    data = meta_get(f"{account_id}/insights", token, params)
    result = []
    for row in data.get("data", []):
        m = _parse_campaign_insights(row)
        result.append({
            "age": row.get("age", "unknown"),
            "gender": row.get("gender", "unknown"),
            **m,
        })
    return result


def _recalc_derived(m: dict) -> None:
    """Recalculate derived metrics after summing raw values."""
    m["roas"]     = round(m["revenue"] / m["spend"], 2)       if m["spend"] > 0      else 0
    m["cpa"]      = round(m["spend"]   / m["conversions"], 2) if m["conversions"] > 0 else 0
    m["ctr"]      = round(m["clicks"]  / m["impressions"] * 100, 2) if m["impressions"] > 0 else 0
    m["cpc_link"] = round(m["spend"]   / m["link_clicks"], 2) if m["link_clicks"] > 0 else 0


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/accounts")
def list_accounts():
    conn = get_db()
    rows = _get_active_accounts(conn)
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["access_token"] = "***"
        result.append(d)
    return result


@router.post("/api/accounts")
def add_account(data: dict):
    conn = get_db()
    import uuid
    aid = str(uuid.uuid4())
    project_id = data.get("project_id") or get_setting("active_project_id", "")
    conn.execute(
        "INSERT INTO ad_accounts (id, name, account_id, bm_id, country, access_token, project_id) VALUES (?,?,?,?,?,?,?)",
        (aid, data["name"], data["account_id"], data.get("bm_id"), data.get("country", "BR"), data["access_token"], project_id),
    )
    conn.commit()
    conn.close()
    return {"id": aid, "status": "success", "message": "Conta adicionada com sucesso!"}


@router.put("/api/accounts/{acc_id}")
def update_account(acc_id: str, data: dict):
    conn = get_db()
    if data.get("access_token"):
        conn.execute("UPDATE ad_accounts SET access_token=?, status='active' WHERE id=?", (data["access_token"], acc_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.delete("/api/accounts/{acc_id}")
def delete_account(acc_id: str):
    conn = get_db()
    conn.execute("DELETE FROM ad_accounts WHERE id=?", (acc_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.post("/api/accounts/test")
def test_account_connection(data: dict):
    token = data.get("access_token", "")
    account_id = data.get("account_id", "")
    if not token or not account_id:
        return {"status": "error", "message": "Token e ID da conta são obrigatórios."}
    campaigns = fetch_meta_campaigns(account_id, token)
    if campaigns:
        return {"status": "success", "message": f"Conectado! {len(campaigns)} campanha(s) encontrada(s)."}
    result = verify_meta_token(token)
    if result["valid"]:
        return {"status": "success", "message": f"Token válido ({result.get('name','')}) — conta pode estar sem campanhas."}
    return {"status": "error", "message": "Não foi possível verificar a conta. Verifique o token."}


@router.get("/api/accounts/with-metrics")
def accounts_with_metrics(period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return all accounts with aggregated metrics from Meta API for the given period."""
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    result = []
    for acc in accounts:
        a = dict(acc)
        token = a.get("access_token", "")
        # Fetch all campaigns (for count) — no insights filter, so all campaigns returned
        camps_data = meta_get(f"{a['account_id']}/campaigns", token, {"fields": "id,status", "limit": 200})
        camps_raw = camps_data.get("data", []) if "data" in camps_data else []
        campaign_count = len(camps_raw)
        active_count = sum(1 for c in camps_raw if c.get("status") == "ACTIVE")
        # Fetch account-level aggregated insights (separate call — always returns data)
        m = _fetch_account_insights(a["account_id"], token, period, date_from, date_to)
        result.append({
            "id": a["id"],
            "name": a["name"],
            "account_id": a["account_id"],
            "bm_id": a.get("bm_id"),
            "country": a.get("country", ""),
            "status": a.get("status", "active"),
            "period": period,
            **{k: m.get(k, 0) for k in _EMPTY_METRICS},
            "campaign_count": campaign_count,
            "active_campaigns": active_count,
        })
    return result


@router.get("/api/accounts/{acc_id}/overview")
def account_overview(acc_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Full account overview: KPI totals + all campaigns with metrics."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    acc = dict(acc_row)
    token = acc.get("access_token", "")
    acct_id = acc["account_id"]
    # 1. Fetch ALL campaigns (no insights filter — returns all regardless of spend)
    camps_data = meta_get(acct_id + "/campaigns", token, {
        "fields": "id,name,status,daily_budget,lifetime_budget", "limit": 200
    })
    campaigns_raw = camps_data.get("data", []) if "data" in camps_data else []
    # 2. Fetch per-campaign insights breakdown (only campaigns with activity)
    camp_ins = _fetch_campaign_insights_breakdown(acct_id, token, period, date_from, date_to)
    # 3. Fetch account-level totals (more reliable than summing campaigns)
    total_m = _fetch_account_insights(acct_id, token, period, date_from, date_to)
    # 4. Build campaign list merging all campaigns + their insights (0 if no activity)
    campaigns = []
    for c in campaigns_raw:
        m = camp_ins.get(c["id"], dict(_EMPTY_METRICS))
        db_raw = c.get("daily_budget")
        lb_raw = c.get("lifetime_budget")
        campaigns.append({
            "id": c["id"],
            "name": c["name"],
            "status": c.get("status", "UNKNOWN").lower(),
            "daily_budget": round(float(db_raw) / 100, 2) if db_raw else None,
            "lifetime_budget": round(float(lb_raw) / 100, 2) if lb_raw else None,
            **m,
        })
    # Sort by spend desc
    campaigns.sort(key=lambda x: x["spend"], reverse=True)
    return {
        "id": acc["id"],
        "name": acc["name"],
        "account_id": acct_id,
        "bm_id": acc.get("bm_id"),
        "country": acc.get("country", ""),
        "status": acc.get("status", "active"),
        "period": period,
        "metrics": total_m,
        "campaigns": campaigns,
    }


@router.get("/api/accounts/{acc_id}/demographics")
def account_demographics(acc_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return demographic breakdown (age + gender) for an ad account."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    acc = dict(acc_row)
    token = acc.get("access_token", "")
    acct_id = acc["account_id"]

    rows = _fetch_demographic_insights(acct_id, token, period, date_from, date_to)

    # ── Aggregate by gender ───────────────────────────────────────────────────
    gender_map: dict = {}
    for r in rows:
        g = r["gender"]
        if g not in gender_map:
            gender_map[g] = dict(_EMPTY_METRICS)
        for k in _EMPTY_METRICS:
            gender_map[g][k] += r.get(k, 0)
    for m in gender_map.values():
        _recalc_derived(m)

    _GENDER_LABELS = {"male": "Homem", "female": "Mulher", "unknown": "Indefinido"}
    gender_rows = sorted(
        [{"gender": g, "gender_label": _GENDER_LABELS.get(g, g.title()), **m}
         for g, m in gender_map.items()],
        key=lambda x: x["spend"], reverse=True,
    )

    # ── Aggregate by age ──────────────────────────────────────────────────────
    age_map: dict = {}
    for r in rows:
        a = r["age"]
        if a not in age_map:
            age_map[a] = dict(_EMPTY_METRICS)
        for k in _EMPTY_METRICS:
            age_map[a][k] += r.get(k, 0)
    for m in age_map.values():
        _recalc_derived(m)

    _AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    age_rows = sorted(
        [{"age": a, **m} for a, m in age_map.items()],
        key=lambda x: _AGE_ORDER.index(x["age"]) if x["age"] in _AGE_ORDER else 99,
    )

    return {"by_gender": gender_rows, "by_age": age_rows}


@router.get("/api/accounts/{acc_id}/campaigns/{camp_id}/adsets")
def campaign_adsets(acc_id: str, camp_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return all ad sets for a campaign with metrics."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    token = dict(acc_row).get("access_token", "")
    # 1. Fetch ALL adsets (no insights filter)
    data = meta_get(f"{camp_id}/adsets", token, {"fields": "id,name,status,daily_budget", "limit": 200})
    adsets_raw = data.get("data", []) if "data" in data else []
    # 2. Fetch per-adset insights breakdown
    adset_ins = _fetch_adset_insights_breakdown(camp_id, token, period, date_from, date_to)
    adsets = []
    for s in adsets_raw:
        m = adset_ins.get(s["id"], dict(_EMPTY_METRICS))
        db_raw = s.get("daily_budget")
        adsets.append({
            "id": s["id"],
            "name": s["name"],
            "status": s.get("status", "UNKNOWN").lower(),
            "daily_budget": round(float(db_raw) / 100, 2) if db_raw else None,
            **m,
        })
    adsets.sort(key=lambda x: x["spend"], reverse=True)
    return adsets


@router.get("/api/accounts/{acc_id}/campaigns/{camp_id}/adsets/{adset_id}/ads")
def adset_ads(acc_id: str, camp_id: str, adset_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return all ads for an adset with metrics."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    token = dict(acc_row).get("access_token", "")
    data = meta_get(f"{adset_id}/ads", token, {"fields": "id,name,status", "limit": 200})
    ads_raw = data.get("data", []) if "data" in data else []
    ad_ins = _fetch_ad_insights_breakdown(adset_id, token, period, date_from, date_to)
    ads = []
    for a in ads_raw:
        ads.append({"id": a["id"], "name": a["name"],
                    "status": a.get("status", "UNKNOWN").lower(),
                    **ad_ins.get(a["id"], dict(_EMPTY_METRICS))})
    ads.sort(key=lambda x: x["spend"], reverse=True)
    return ads
