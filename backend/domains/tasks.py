"""Tasks domain routes."""
import uuid
from fastapi import APIRouter, HTTPException
from datetime import datetime
from backend.core.db import get_db

router = APIRouter()


@router.get("/api/tasks")
def list_tasks(project_id: str = "", status: str = ""):
    conn = get_db()
    q = "SELECT * FROM tasks WHERE 1=1"
    params = []
    if project_id:
        q += " AND project_id=?"
        params.append(project_id)
    if status:
        q += " AND status=?"
        params.append(status)
    q += " ORDER BY due_date ASC, created_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/tasks")
def create_task(data: dict):
    tid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, responsible, origin) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (tid, data.get("project_id", ""), data.get("title", ""), data.get("description", ""),
         "open", data.get("priority", "normal"), data.get("due_date", ""),
         data.get("responsible", ""), "platform"))
    conn.commit()
    conn.close()
    return {"id": tid, "ok": True}


@router.put("/api/tasks/{tid}")
def update_task(tid: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE tasks SET "
        "title=COALESCE(?,title), status=COALESCE(?,status), priority=COALESCE(?,priority), "
        "due_date=COALESCE(?,due_date), responsible=COALESCE(?,responsible), updated_at=? "
        "WHERE id=?",
        (data.get("title"), data.get("status"), data.get("priority"),
         data.get("due_date"), data.get("responsible"), datetime.now().isoformat(), tid))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/api/tasks/{tid}/complete")
def complete_task(tid: str):
    conn = get_db()
    conn.execute("UPDATE tasks SET status='done', updated_at=? WHERE id=?",
                 (datetime.now().isoformat(), tid))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/api/tasks/{tid}")
def delete_task(tid: str):
    conn = get_db()
    conn.execute("DELETE FROM tasks WHERE id=?", (tid,))
    conn.commit()
    conn.close()
    return {"ok": True}
