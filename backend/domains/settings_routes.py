"""
Settings domain routes.
"""
from fastapi import APIRouter
from backend.core.db import get_db

router = APIRouter()


@router.get("/api/settings")
def get_settings():
    conn = get_db()
    rows = conn.execute("SELECT * FROM settings").fetchall()
    conn.close()
    result = {r["key"]: r["value"] for r in rows}
    # Never expose API key values — replace with a flag
    for secret_key in ("anthropic_api_key", "openai_api_key"):
        if secret_key in result:
            result[secret_key + "_set"] = "true"
            del result[secret_key]
    return result


@router.post("/api/settings")
def save_settings(data: dict):
    conn = get_db()
    for key, val in data.items():
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, str(val)))
    conn.commit()
    conn.close()
    return {"status": "success"}
