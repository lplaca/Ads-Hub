"""
Rules domain routes.
"""
import json, os, uuid
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db
from backend.core.settings import get_setting
from backend.services.rule_engine import run_rules_engine
from backend.integrations.ai_client import parse_rule_with_ai

router = APIRouter()


@router.get("/api/rules")
def list_rules():
    conn = get_db()
    rows = conn.execute("SELECT * FROM rules").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["conditions"] = json.loads(d["conditions"])
        d["enabled"] = bool(d["enabled"])
        result.append(d)
    return result


@router.post("/api/rules")
def create_rule(data: dict):
    conn = get_db()
    rid = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO rules (id, name, conditions, action, enabled) VALUES (?,?,?,?,?)",
        (rid, data["name"], json.dumps(data["conditions"]), data["action"], int(data.get("enabled", True))),
    )
    conn.commit()
    conn.close()
    return {"id": rid, "status": "success"}


@router.put("/api/rules/{rule_id}")
def update_rule(rule_id: str, data: dict):
    conn = get_db()
    if "name" in data or "conditions" in data or "action" in data:
        conn.execute(
            "UPDATE rules SET name=?, conditions=?, action=?, enabled=? WHERE id=?",
            (data.get("name"), json.dumps(data.get("conditions", [])), data.get("action"),
             int(data.get("enabled", True)), rule_id)
        )
    elif "enabled" in data:
        conn.execute("UPDATE rules SET enabled=? WHERE id=?", (int(data["enabled"]), rule_id))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: str):
    conn = get_db()
    conn.execute("DELETE FROM rules WHERE id=?", (rule_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.post("/api/rules/run-engine")
def trigger_rule_engine():
    """Manually trigger the rule engine to evaluate all active rules."""
    try:
        result = run_rules_engine()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/rules/engine-log")
def get_engine_log():
    """Get the last 10 rule engine runs."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM rule_engine_log ORDER BY ran_at DESC LIMIT 10"
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["summary"] = json.loads(d["summary"])
        except Exception:
            d["summary"] = []
        result.append(d)
    return result


@router.post("/api/rules/parse-natural")
def parse_natural_rule(data: dict):
    """Use AI (Anthropic or OpenAI) to parse a natural language description into a rule structure."""
    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto da regra é obrigatório.")

    # Determine provider + key
    provider = data.get("provider") or get_setting("ai_provider") or "anthropic"
    if provider == "openai":
        api_key = data.get("api_key") or get_setting("openai_api_key") or os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=400, detail="Chave OpenAI não configurada. Adicione em Configurações → Integrações.")
    else:
        api_key = data.get("api_key") or get_setting("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=400, detail="Chave Anthropic não configurada. Adicione em Configurações → Integrações.")

    try:
        rule = parse_rule_with_ai(text, provider, api_key)
        return {"status": "success", "rule": rule, "provider": provider}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
