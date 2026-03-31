"""Products domain — marketing products per project."""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db

router = APIRouter()


@router.get("/api/products")
def list_products(project_id: Optional[str] = None):
    conn = get_db()
    if project_id:
        rows = conn.execute(
            "SELECT * FROM products WHERE project_id=? ORDER BY created_at DESC", (project_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM products ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/products")
def create_product(data: dict):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome obrigatório")
    pid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO products (id, project_id, name, description, sku, price, category, status, landing_url) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (
            pid,
            data.get("project_id", ""),
            name,
            data.get("description", ""),
            data.get("sku", ""),
            float(data.get("price", 0)),
            data.get("category", ""),
            data.get("status", "active"),
            data.get("landing_url", ""),
        ),
    )
    conn.commit()
    conn.close()
    return {"id": pid, "name": name, "ok": True}


@router.put("/api/products/{pid}")
def update_product(pid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    r = dict(row)
    conn.execute(
        "UPDATE products SET name=?, description=?, sku=?, price=?, category=?, status=?, landing_url=? WHERE id=?",
        (
            data.get("name", r["name"]),
            data.get("description", r["description"]),
            data.get("sku", r["sku"]),
            float(data.get("price", r["price"])),
            data.get("category", r["category"]),
            data.get("status", r["status"]),
            data.get("landing_url", r["landing_url"]),
            pid,
        ),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/api/products/{pid}")
def delete_product(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}
