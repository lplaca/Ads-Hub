"""
Application settings helpers.
"""
from backend.core.db import get_db


def get_setting(key: str, default: str = "") -> str:
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def get_active_project_id() -> str:
    return get_setting("active_project_id", "")


def _get_active_accounts(conn) -> list:
    """Return ad accounts filtered by the currently active project.
    Returns [] when no project is active — never leaks data across projects."""
    active = get_active_project_id()
    if not active:
        return []
    return conn.execute(
        "SELECT * FROM ad_accounts WHERE project_id=? AND status='active'",
        (active,)
    ).fetchall()
