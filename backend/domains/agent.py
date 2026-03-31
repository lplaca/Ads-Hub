"""
AI Agent domain routes.
"""
import json, os
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
import anthropic
from backend.core.db import get_db
from backend.core.settings import get_setting
from backend.integrations.ai_client import (
    get_agent_config, set_agent_config,
    run_ai_cycle_logic,
)

router = APIRouter()


@router.get("/api/agent/status")
def get_agent_status():
    conn = get_db()
    last_cycle = conn.execute("SELECT * FROM ai_cycles ORDER BY started_at DESC LIMIT 1").fetchone()
    total_decisions = conn.execute("SELECT COUNT(*) FROM ai_decisions WHERE executed=1").fetchone()[0]
    conn.close()
    autonomy = get_agent_config("autonomy_level", "1")
    interval = get_agent_config("cycle_interval_hours", "4")
    last_at = get_agent_config("last_cycle_at", "")
    last_status = get_agent_config("last_cycle_status", "")
    last_summary = get_agent_config("last_cycle_summary", "")
    next_at = ""
    if last_at:
        try:
            last_dt = datetime.fromisoformat(last_at)
            next_dt = last_dt + timedelta(hours=float(interval))
            next_at = next_dt.isoformat()
        except Exception:
            pass
    return {
        "autonomy_level": int(autonomy),
        "cycle_interval_hours": float(interval),
        "last_cycle_at": last_at,
        "last_cycle_status": last_status,
        "last_cycle_summary": last_summary,
        "next_cycle_at": next_at,
        "total_decisions_executed": total_decisions,
        "last_cycle": dict(last_cycle) if last_cycle else None,
    }


@router.post("/api/agent/run")
def trigger_ai_cycle():
    """Manually trigger an AI analysis cycle."""
    api_key = get_setting("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="Chave Anthropic não configurada. Vá em Configurações → Integrações.")
    try:
        result = run_ai_cycle_logic(api_key)
        return {"status": "success", **result}
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Claude retornou resposta inesperada. Tente novamente.")
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Chave Anthropic inválida.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agent/cycles")
def get_cycles(limit: int = 20):
    conn = get_db()
    rows = conn.execute("SELECT * FROM ai_cycles ORDER BY started_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try: d["insights"] = json.loads(d["insights"])
        except: d["insights"] = []
        try: d["alerts_json"] = json.loads(d["alerts_json"])
        except: d["alerts_json"] = []
        d.pop("raw_analysis", None)
        result.append(d)
    return result


@router.get("/api/agent/decisions")
def get_decisions(limit: int = 50, executed: Optional[int] = None):
    conn = get_db()
    if executed is not None:
        rows = conn.execute("SELECT * FROM ai_decisions WHERE executed=? ORDER BY created_at DESC LIMIT ?", (executed, limit)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM ai_decisions ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/api/agent/config")
def get_agent_config_endpoint():
    conn = get_db()
    rows = conn.execute("SELECT * FROM agent_config").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


@router.post("/api/agent/config")
def save_agent_config(data: dict):
    conn = get_db()
    for key, val in data.items():
        conn.execute("INSERT OR REPLACE INTO agent_config (key, value) VALUES (?,?)", (key, str(val)))
    conn.commit()
    conn.close()
    return {"status": "success"}
