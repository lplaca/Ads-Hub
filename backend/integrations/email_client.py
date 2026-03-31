"""
Email client: SMTP sending and alert email HTML builder.
"""
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime


def _send_email(to_addr: str, subject: str, html_body: str, s: dict) -> dict:
    """Send an email using SMTP settings from the settings dict."""
    smtp_host = s.get("smtp_host", "smtp.gmail.com")
    smtp_port = int(s.get("smtp_port", "587") or "587")
    smtp_user = s.get("smtp_user", "")
    smtp_pass = s.get("smtp_pass", "")
    from_addr = smtp_user or s.get("emailAddr", "")

    if not smtp_user or not smtp_pass or not to_addr:
        return {"ok": False, "error": "SMTP não configurado (smtp_user / smtp_pass / emailAddr)"}

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = from_addr
    msg["To"]      = to_addr
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
            srv.ehlo()
            srv.starttls(context=ctx)
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(from_addr, to_addr, msg.as_string())
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _build_alert_email_html(alerts: list, campaigns: list) -> str:
    """Build HTML email body for campaign alerts."""
    now = datetime.now().strftime("%d/%m/%Y %H:%M")

    # Build campaign lookup for metrics
    camp_map = {c["id"]: c for c in campaigns} if campaigns else {}

    rows_html = ""
    for a in alerts:
        camp = camp_map.get(a.get("campaign_id", ""), {})
        spend  = f"${float(a.get('spend') or camp.get('spend') or 0):.2f}"
        roas   = f"{float(camp.get('roas') or 0):.2f}x"
        status = a.get("severity", "warning")
        color  = "#ef4444" if status == "critical" else "#f59e0b"
        icon   = "🔴" if status == "critical" else "⚠️"
        rows_html += f"""
        <tr>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0;">{icon} {a.get('campaign_name','—')}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:{color}; font-weight:600;">{a.get('severity','warning').upper()}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#94a3b8;">{a.get('message','')}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0;">{spend}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0;">{roas}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">📊</div>
        <div>
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">Meta Ads — Alertas</h1>
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">{now}</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">
      <p style="color:#cbd5e1;font-size:14px;margin:0 0 16px;">
        Foram detectadas <strong style="color:#f87171;">{len(alerts)} campanha(s)</strong> que precisam de atenção.
        Verifique e considere pausar ou ajustar o orçamento.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0f172a;">
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Campanha</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Nível</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Motivo</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Gasto</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>

      <div style="margin-top:20px;padding:12px 16px;background:#0f172a;border-radius:10px;border-left:3px solid #3b82f6;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">
          Acesse a plataforma para tomar ação: pause campanhas, ajuste orçamentos ou altere segmentações conforme necessário.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #334155;">
      <p style="margin:0;color:#475569;font-size:11px;text-align:center;">Ads Hub — Alerta automático</p>
    </div>
  </div>
</body>
</html>"""
