"""ClickUp API client."""
import requests

CLICKUP_API = "https://api.clickup.com/api/v2"


def clickup_get(path: str, token: str) -> dict:
    r = requests.get(f"{CLICKUP_API}{path}", headers={"Authorization": token}, timeout=10)
    return r.json() if r.ok else {}


def get_workspaces(token: str) -> list:
    data = clickup_get("/team", token)
    return data.get("teams", [])


def get_spaces(team_id: str, token: str) -> list:
    data = clickup_get(f"/team/{team_id}/space", token)
    return data.get("spaces", [])


def get_lists(space_id: str, token: str) -> list:
    data = clickup_get(f"/space/{space_id}/list", token)
    return data.get("lists", [])


def get_tasks(list_id: str, token: str) -> list:
    data = clickup_get(f"/list/{list_id}/task?include_closed=false", token)
    return data.get("tasks", [])


def create_task(list_id: str, token: str, title: str, description: str = "",
                priority: int = 3, due_date: int = None) -> dict:
    payload = {"name": title, "description": description, "priority": priority}
    if due_date:
        payload["due_date"] = due_date
    r = requests.post(
        f"{CLICKUP_API}/list/{list_id}/task",
        headers={"Authorization": token, "Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )
    return r.json() if r.ok else {"error": r.text}
