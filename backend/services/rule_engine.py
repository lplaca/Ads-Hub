"""
Rule engine: evaluate automation rules against live campaign metrics.
"""
import json, uuid
from datetime import datetime, timedelta
from backend.core.db import get_db
from backend.core.settings import _get_active_accounts
from backend.integrations.meta_client import fetch_meta_campaigns, fetch_meta_insights, pause_meta_campaign, activate_meta_campaign


def gen_time_series(days=7):
    """Retorna slots zerados para os últimos N dias. Dados reais vêm da API de cada plataforma."""
    return [
        {"date": (datetime.now() - timedelta(days=days - i - 1)).strftime("%d/%m"),
         "invest": 0.0, "conversions": 0, "roas": 0.0}
        for i in range(days)
    ]


def eval_condition(metric: str, operator: str, value, campaign: dict) -> bool:
    """Evaluate a single rule condition against a campaign's metrics."""
    actual = campaign.get(metric, 0)
    try:
        actual = float(actual)
        value = float(value)
    except (TypeError, ValueError):
        return False
    if operator == ">=": return actual >= value
    if operator == "<=": return actual <= value
    if operator == "==": return actual == value
    if operator == ">":  return actual > value
    if operator == "<":  return actual < value
    return False


def run_rules_engine() -> dict:
    """
    Main rules engine: evaluate all active rules against all campaigns.
    Returns a summary dict.
    """
    conn = get_db()
    rules_rows = conn.execute("SELECT * FROM rules WHERE enabled=1").fetchall()
    accounts_rows = _get_active_accounts(conn)
    conn.close()

    rules = []
    for r in rules_rows:
        d = dict(r)
        d["conditions"] = json.loads(d["conditions"])
        rules.append(d)

    campaigns = []
    if not accounts_rows:
        return {"rules_checked": 0, "campaigns_checked": 0, "actions_taken": 0, "demo_mode": False, "log": []}

    for acc in accounts_rows:
            acc_d = dict(acc)
            token = acc_d["access_token"]
            account_id = acc_d["account_id"]
            meta_camps = fetch_meta_campaigns(account_id, token)
            for mc in meta_camps:
                insights = fetch_meta_insights(mc["id"], token, "today")
                daily_budget = float(mc.get("daily_budget", 0)) / 100.0  # Meta returns cents
                spend = insights.get("spend", 0)
                spend_pct = round((spend / daily_budget * 100), 1) if daily_budget > 0 else 0
                now = datetime.now()
                campaigns.append({
                    "id": mc["id"],
                    "name": mc["name"],
                    "account": acc_d["name"],
                    "account_id": acc_d["id"],
                    "country": acc_d.get("country", ""),
                    "status": mc["status"].lower(),
                    "spend": spend,
                    "spend_pct": spend_pct,
                    "conversions": insights.get("conversions", 0),
                    "checkouts": insights.get("checkouts", 0),
                    "roas": insights.get("roas", 0),
                    "cpa": insights.get("cpa", 0),
                    "ctr": insights.get("ctr", 0),
                    "daily_budget": daily_budget,
                    "_token": token,
                    "running_hours": 0,
                    "time_of_day": now.hour,
                    "day_of_week": now.weekday(),
                    "created_today": 0,
                })

    actions_taken = 0
    log_entries = []
    conn = get_db()

    for rule in rules:
        if not rule.get("enabled", True):
            continue
        conditions = rule["conditions"]
        for camp in campaigns:
            if camp.get("status") == "paused" and rule["action"] not in ("activate",):
                continue
            all_match = all(eval_condition(c["metric"], c["operator"], c["value"], camp) for c in conditions)
            if not all_match:
                continue

            # Condition matched — take action
            action = rule["action"]
            camp_id = camp["id"]
            camp_name = camp["name"]
            token = camp.get("_token", "")
            success = True

            if action == "pause":
                if token:
                    success = pause_meta_campaign(camp_id, token)
                camp["status"] = "paused"
                severity = "critical"
                msg = f"Regra '{rule['name']}' → Campanha pausada automaticamente"
            elif action == "activate":
                if token:
                    success = activate_meta_campaign(camp_id, token)
                camp["status"] = "active"
                severity = "info"
                msg = f"Regra '{rule['name']}' → Campanha ativada automaticamente"
            elif action == "notify":
                severity = "warning"
                cond_str = ', '.join([str(c['metric']) + ' ' + str(c['operator']) + ' ' + str(c['value']) for c in conditions])
                msg = f"Regra '{rule['name']}' -> {cond_str}"
            elif action == "budget":
                severity = "warning"
                msg = f"Regra '{rule['name']}' → Orçamento requer ajuste"
            else:
                severity = "info"
                msg = f"Regra '{rule['name']}' disparou"

            if success:
                # Create alert in DB
                alert_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT OR IGNORE INTO alerts (id, campaign_id, campaign_name, rule_id, rule_name, message, severity, status, spend, conversions) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (alert_id, camp_id, camp_name, rule["id"], rule["name"], msg, severity, "active",
                     camp.get("spend", 0), camp.get("conversions", 0))
                )
                # Update trigger_count
                conn.execute("UPDATE rules SET trigger_count=trigger_count+1, last_run=? WHERE id=?",
                             (datetime.now().isoformat(), rule["id"]))
                actions_taken += 1
                log_entries.append(f"{camp_name}: {msg}")

    conn.commit()

    # Log this run
    log_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO rule_engine_log (id, rules_checked, campaigns_checked, actions_taken, summary) VALUES (?,?,?,?,?)",
        (log_id, len(rules), len(campaigns), actions_taken, json.dumps(log_entries))
    )
    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "rules_checked": len(rules),
        "campaigns_checked": len(campaigns),
        "actions_taken": actions_taken,
        "demo_mode": False,
        "log": log_entries,
    }
