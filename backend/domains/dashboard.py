"""
Dashboard, stats, and status routes.
"""
import os
from typing import Optional
from fastapi import APIRouter
from backend.core.db import get_db
from backend.core.settings import _get_active_accounts
from backend.integrations.meta_client import fetch_meta_campaigns, fetch_meta_insights
from backend.services.rule_engine import gen_time_series

router = APIRouter()

# ── Dashboard cache to avoid hitting Meta API on every request ─────────────
_dashboard_cache = {"data": None, "ts": 0}

_PERIOD_DAYS = {"today": 1, "yesterday": 1, "last_7d": 7, "last_14d": 14, "last_30d": 30, "last_90d": 90}


def _fetch_all_campaigns_cached(ttl: int = 300, force: bool = False):
    """Fetch all campaigns with insights, cached for `ttl` seconds."""
    import time as _time
    now = _time.time()
    if not force and _dashboard_cache["data"] is not None and (now - _dashboard_cache["ts"]) < ttl:
        return _dashboard_cache["data"]

    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return []

    all_campaigns = []
    for acc in accounts:
        acc_d = dict(acc)
        meta_camps = fetch_meta_campaigns(acc_d["account_id"], acc_d["access_token"])
        for mc in meta_camps:
            insights = fetch_meta_insights(mc["id"], acc_d["access_token"])
            camp = {
                "id": mc["id"],
                "name": mc["name"],
                "account": acc_d["name"],
                "account_id": acc_d["id"],
                "country": acc_d.get("country", ""),
                "status": mc.get("status", "UNKNOWN").lower(),
                "spend": insights.get("spend", 0),
                "conversions": insights.get("conversions", 0),
                "revenue": insights.get("revenue", 0),
                "roas": insights.get("roas", 0),
                "cpa": insights.get("cpa", 0),
                "ctr": insights.get("ctr", 0),
            }
            all_campaigns.append(camp)

    _dashboard_cache["data"] = all_campaigns
    _dashboard_cache["ts"] = now
    return all_campaigns


@router.get("/api/stats")
def get_stats():
    conn = get_db()
    acc_count = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0]
    conn.close()
    if acc_count == 0:
        return {
            "total_investment": 0, "total_conversions": 0, "avg_roas": 0,
            "active_alerts": 0, "investment_change": 0,
            "conversions_change": 0, "roas_change": 0, "alerts_change": 0,
        }
    # Real: aggregate from campaigns
    campaigns = _fetch_all_campaigns_cached()
    total_spend = sum(c.get("spend", 0) for c in campaigns)
    total_conv = sum(c.get("conversions", 0) for c in campaigns)
    total_revenue = sum(c.get("revenue", 0) for c in campaigns)
    avg_roas = round(total_revenue / total_spend, 2) if total_spend > 0 else 0
    return {
        "total_investment": round(total_spend, 2),
        "total_conversions": total_conv,
        "avg_roas": avg_roas,
        "active_alerts": 0,
        "investment_change": 0,
        "conversions_change": 0,
        "roas_change": 0,
        "alerts_change": 0,
    }


@router.delete("/api/dashboard/cache")
def clear_dashboard_cache():
    """Force-clear the dashboard campaign cache."""
    _dashboard_cache["data"] = None
    _dashboard_cache["ts"] = 0
    return {"ok": True}


@router.get("/api/dashboard")
def get_dashboard(period: str = "last_7d", view_by: str = "account", force: bool = False):
    conn = get_db()
    acc_count = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0]
    conn.close()

    if acc_count == 0:
        return {
            "demo": False,
            "stats": {"total_investment": 0, "total_conversions": 0, "avg_roas": 0, "active_alerts": 0, "investment_change": 0, "conversions_change": 0, "roas_change": 0},
            "time_series": [],
            "by_account": [],
            "by_product": [],
            "by_country": [],
            "campaigns": [],
        }

    # ── Real mode — aggregate from Meta API ─────────────────────────────────
    campaigns = _fetch_all_campaigns_cached(force=force)
    total_spend = sum(c.get("spend", 0) for c in campaigns)
    total_conv = sum(c.get("conversions", 0) for c in campaigns)
    total_revenue = sum(c.get("revenue", 0) for c in campaigns)
    avg_roas = round(total_revenue / total_spend, 2) if total_spend > 0 else 0

    # By account
    by_account = {}
    for c in campaigns:
        acc = c["account"]
        if acc not in by_account:
            by_account[acc] = {"name": acc, "account_id": c["account_id"], "country": c["country"], "spend": 0, "conversions": 0, "revenue": 0}
        by_account[acc]["spend"] += c.get("spend", 0)
        by_account[acc]["conversions"] += c.get("conversions", 0)
        by_account[acc]["revenue"] += c.get("revenue", 0)
    for a in by_account.values():
        a["roas"] = round(a["revenue"] / a["spend"], 2) if a["spend"] > 0 else 0
        a["cpa"] = round(a["spend"] / a["conversions"], 2) if a["conversions"] > 0 else 0
        a["spend"] = round(a["spend"], 2)

    # By country
    by_country = {}
    for c in campaigns:
        ct = c.get("country", "??")
        if ct not in by_country:
            by_country[ct] = {"name": ct, "invest": 0, "conversions": 0}
        by_country[ct]["invest"] += c.get("spend", 0)
        by_country[ct]["conversions"] += c.get("conversions", 0)
    for v in by_country.values():
        v["invest"] = round(v["invest"], 2)

    return {
        "demo": False,
        "stats": {
            "total_investment": round(total_spend, 2),
            "total_conversions": total_conv,
            "avg_roas": avg_roas,
            "active_alerts": 0,
            "investment_change": 0,
            "conversions_change": 0,
            "roas_change": 0,
        },
        "time_series": gen_time_series(_PERIOD_DAYS.get(period, 7)),
        "by_account": list(by_account.values()),
        "by_country": list(by_country.values()),
        "campaigns": campaigns,
    }


@router.get("/api/status")
def get_status():
    conn = get_db()
    bm_count   = conn.execute("SELECT COUNT(*) FROM business_managers").fetchone()[0]
    acc_count  = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0]
    rule_count = conn.execute("SELECT COUNT(*) FROM rules").fetchone()[0]
    alert_count= conn.execute("SELECT COUNT(*) FROM alerts WHERE status='active'").fetchone()[0]
    anthropic_set = conn.execute("SELECT COUNT(*) FROM settings WHERE key='anthropic_api_key' AND value!=''").fetchone()[0]
    openai_set    = conn.execute("SELECT COUNT(*) FROM settings WHERE key='openai_api_key' AND value!=''").fetchone()[0]
    ai_provider   = conn.execute("SELECT value FROM settings WHERE key='ai_provider'").fetchone()
    last_log      = conn.execute("SELECT ran_at, actions_taken FROM rule_engine_log ORDER BY ran_at DESC LIMIT 1").fetchone()
    conn.close()
    provider = ai_provider["value"] if ai_provider else "anthropic"
    ai_configured = (
        (provider == "openai" and (bool(openai_set) or bool(os.environ.get("OPENAI_API_KEY")))) or
        (provider == "anthropic" and (bool(anthropic_set) or bool(os.environ.get("ANTHROPIC_API_KEY"))))
    )
    return {
        "demo_mode": False,
        "bm_count": bm_count,
        "account_count": acc_count,
        "rule_count": rule_count,
        "alert_count": alert_count,
        "ai_configured": ai_configured,
        "ai_provider": provider,
        "last_engine_run": dict(last_log) if last_log else None,
    }
