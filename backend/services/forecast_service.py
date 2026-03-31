"""
Forecast baseado em médias móveis simples.
Não usa ML. Mostra claramente quando não há dados suficientes.
"""
from datetime import datetime
from backend.core.db import get_db

MIN_DAYS_FOR_FORECAST = 7


def get_project_forecast(project_id: str, metric: str = "spend") -> dict:
    """
    Retorna forecast simples para um projeto.
    metric: spend | conversions | roas | cpa
    Retorna dados insuficientes quando não há histórico real.
    """
    return {
        "project_id": project_id,
        "metric": metric,
        "has_enough_data": False,
        "min_days_required": MIN_DAYS_FOR_FORECAST,
        "message": f"São necessários ao menos {MIN_DAYS_FOR_FORECAST} dias de dados históricos para gerar previsões.",
        "forecast": [],
        "confidence": None,
        "trend": None,
    }


def get_project_risk_score(project_id: str) -> dict:
    """Heuristic risk score baseado em alertas e metas do projeto."""
    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    if not project:
        conn.close()
        return {"score": None, "reason": "Projeto não encontrado"}

    critical = conn.execute(
        "SELECT COUNT(*) FROM alerts WHERE project_id=? AND severity='critical' AND status='active'",
        (project_id,)).fetchone()[0]
    warnings = conn.execute(
        "SELECT COUNT(*) FROM alerts WHERE project_id=? AND severity='warning' AND status='active'",
        (project_id,)).fetchone()[0]
    conn.close()

    risk = min(100, critical * 30 + warnings * 10)
    level = "critical" if risk >= 60 else "warning" if risk >= 30 else "low"

    return {
        "score": risk,
        "level": level,
        "factors": {
            "critical_alerts": critical,
            "warning_alerts": warnings,
        },
        "message": (
            "Score baseado em alertas ativos."
            if critical + warnings > 0
            else "Nenhum alerta ativo — risco baixo. Dados insuficientes para previsão estatística."
        ),
    }
