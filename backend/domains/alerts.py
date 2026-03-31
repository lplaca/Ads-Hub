"""
Alerts domain routes (including email alert endpoints).
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db
from backend.integrations.email_client import _send_email, _build_alert_email_html

router = APIRouter()


@router.get("/api/alerts")
def list_alerts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM alerts WHERE status='active' ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/alerts/{alert_id}/ignore")
def ignore_alert(alert_id: str):
    conn = get_db()
    conn.execute("UPDATE alerts SET status='ignored' WHERE id=?", (alert_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.post("/api/alerts/send-email")
def send_alert_email(data: dict = {}):
    """Send email with current active alerts + optional specific campaign list."""
    conn = get_db()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    s = {r["key"]: r["value"] for r in settings_rows}

    # Get alerts to send
    alert_ids = data.get("alert_ids", [])
    if alert_ids:
        placeholders = ",".join("?" * len(alert_ids))
        alerts = [dict(r) for r in conn.execute(f"SELECT * FROM alerts WHERE id IN ({placeholders})", alert_ids).fetchall()]
    else:
        alerts = [dict(r) for r in conn.execute("SELECT * FROM alerts WHERE status='active' ORDER BY severity DESC, created_at DESC LIMIT 20").fetchall()]

    # Get campaign metrics for enrichment
    try:
        campaigns = [dict(r) for r in conn.execute("SELECT * FROM campaigns LIMIT 500").fetchall()]
    except Exception:
        campaigns = []
    conn.close()

    if not alerts:
        return {"ok": False, "error": "Nenhum alerta ativo para enviar"}

    to_addr = data.get("to", s.get("emailAddr", s.get("email_alert_to", "")))
    subject = data.get("subject", f"Meta Ads — {len(alerts)} alerta(s) de campanha [{datetime.now().strftime('%d/%m/%Y %H:%M')}]")
    html_body = _build_alert_email_html(alerts, campaigns)
    result = _send_email(to_addr, subject, html_body, s)
    return result


@router.post("/api/alerts/test-email")
def test_alert_email(data: dict = {}):
    """Send a test email to verify SMTP config."""
    conn = get_db()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    s = {r["key"]: r["value"] for r in settings_rows}
    to_addr = data.get("to", s.get("emailAddr", ""))
    if not to_addr:
        raise HTTPException(status_code=400, detail="Email de destino não configurado em Configurações")
    html = f"""<div style="font-family:Arial;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#3b82f6;">✅ Email de teste — Meta Ads</h2>
        <p>Configuração de email funcionando! Você receberá alertas de campanhas neste endereço.</p>
        <p style="color:#64748b;font-size:12px;">{datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
    </div>"""
    result = _send_email(to_addr, "Teste — Ads Hub", html, s)
    return result
