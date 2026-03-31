"""Health checks para todas as integrações."""
import requests
from backend.core.db import get_db
from backend.core.settings import get_setting

def check_meta_token(token: str) -> dict:
    try:
        r = requests.get("https://graph.facebook.com/v19.0/me", params={"access_token": token}, timeout=8)
        if r.ok:
            data = r.json()
            return {"ok": True, "user_id": data.get("id"), "name": data.get("name")}
        return {"ok": False, "error": r.json().get("error", {}).get("message", "Token inválido")}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_notion_token(token: str) -> dict:
    try:
        r = requests.get("https://api.notion.com/v1/users/me",
                        headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28"},
                        timeout=8)
        return {"ok": r.ok, "error": None if r.ok else r.json().get("message", "Token inválido")}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_clickup_token(token: str) -> dict:
    try:
        r = requests.get("https://api.clickup.com/api/v2/user",
                        headers={"Authorization": token}, timeout=8)
        if r.ok:
            user = r.json().get("user", {})
            return {"ok": True, "user_id": user.get("id"), "username": user.get("username")}
        return {"ok": False, "error": "Token inválido"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def get_all_integrations_health() -> dict:
    conn = get_db()
    results = {}
    bms = conn.execute("SELECT id, name, bm_id, access_token FROM business_managers WHERE status='connected'").fetchall()
    results["meta_bms"] = []
    for bm in bms:
        h = check_meta_token(bm["access_token"])
        results["meta_bms"].append({"id": bm["id"], "name": bm["name"], **h})
    notion_token = get_setting("notion_token", "")
    if notion_token:
        results["notion"] = check_notion_token(notion_token)
    clickup_token = get_setting("clickup_token", "")
    if clickup_token:
        results["clickup"] = check_clickup_token(clickup_token)
    conn.close()
    return results
