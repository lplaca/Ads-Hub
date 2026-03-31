"""
Reports and analysis overview routes.
"""
from typing import Optional
from fastapi import APIRouter
from backend.core.db import get_db
from backend.services.rule_engine import gen_time_series
from backend.domains.dashboard import _fetch_all_campaigns_cached
from backend.integrations.ai_client import MOCK_CAMPAIGNS

router = APIRouter()


@router.post("/api/reports/generate")
def generate_report(data: dict):
    days = data.get("days", 7)
    campaigns = _fetch_all_campaigns_cached()
    total_invest = sum(c.get("spend", 0) for c in campaigns)
    total_conv = sum(c.get("conversions", 0) for c in campaigns)
    total_rev = sum(c.get("revenue", 0) for c in campaigns)
    avg_roas = round(total_rev / total_invest, 2) if total_invest > 0 else 0
    avg_cpa = round(total_invest / total_conv, 2) if total_conv > 0 else 0
    by_acc = {}
    for c in campaigns:
        acc = c.get("account", "")
        if acc not in by_acc:
            by_acc[acc] = {"name": acc, "spend": 0, "conversions": 0}
        by_acc[acc]["spend"] += c.get("spend", 0)
        by_acc[acc]["conversions"] += c.get("conversions", 0)
    return {
        "status": "success",
        "data": {
            "time_series": gen_time_series(days),
            "summary": {
                "total_invest": round(total_invest, 2),
                "total_conversions": total_conv,
                "avg_roas": avg_roas,
                "avg_cpa": avg_cpa,
            },
            "by_account": list(by_acc.values()),
        },
    }


@router.get("/api/analysis/overview")
def get_analysis_overview(days: int = 30):
    """Return aggregated analysis data: time series, by-product, by-campaign."""
    conn = get_db()
    is_demo = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0] == 0
    conn.close()
    ts = gen_time_series(days)
    return {
        "time_series": ts,
        "by_product": [
            {"name": "PROD001", "invest": 1580.20, "conversions": 57, "roas": 3.2, "cpa": 27.72, "ctr": 2.1, "cpm": 12.4},
            {"name": "PROD002", "invest": 1124.90, "conversions": 42, "roas": 3.0, "cpa": 26.78, "ctr": 1.8, "cpm": 14.2},
            {"name": "PROD003", "invest": 643.00,  "conversions": 19, "roas": 3.7, "cpa": 33.84, "ctr": 2.8, "cpm": 10.9},
        ],
        "campaigns": MOCK_CAMPAIGNS if is_demo else [],
        "summary": {
            "total_invest": sum(d["invest"] for d in ts),
            "total_conv": sum(d["conversions"] for d in ts),
            "avg_roas": round(sum(d["roas"] for d in ts) / len(ts), 2),
        }
    }


@router.get("/api/intelligence/forecast/{project_id}")
def project_forecast(project_id: str, metric: str = "spend"):
    from backend.services.forecast_service import get_project_forecast
    return get_project_forecast(project_id, metric)


@router.get("/api/intelligence/risk/{project_id}")
def project_risk(project_id: str):
    from backend.services.forecast_service import get_project_risk_score
    return get_project_risk_score(project_id)
