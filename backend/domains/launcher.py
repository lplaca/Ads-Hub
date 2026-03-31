"""
Campaign Launcher domain routes.
"""
import json, threading, uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from backend.core.db import get_db
from backend.core.config import _launch_threads
from backend.services.launcher_service import create_full_campaign

router = APIRouter()


@router.post("/api/launcher/launch")
def launch_campaign(data: dict):
    product_id = data.get("product_id", "")
    conn = get_db()
    product_row = conn.execute("SELECT * FROM imported_products WHERE id=?", (product_id,)).fetchone()
    if not product_row:
        conn.close()
        raise HTTPException(404, "Produto não encontrado")
    product = dict(product_row)
    product["urls_videos"] = product.get("urls_videos", "[]")
    product["paises"] = product.get("paises", "[]")

    # Find matching sheets account
    account_row = conn.execute("SELECT * FROM sheets_accounts WHERE config_id=?",
                               (product["config_id"],)).fetchone()
    if not account_row:
        conn.close()
        raise HTTPException(400, f"Conta Meta não encontrada para Config_ID: {product['config_id']}. Sincronize a aba Configurações.")
    account = dict(account_row)

    # Create job record
    job_id = str(uuid.uuid4())
    video_count = len(json.loads(product["urls_videos"]))
    conn.execute("""
        INSERT INTO launch_jobs (id, product_id, product_name, status, step, step_detail, total_videos, started_at)
        VALUES (?, ?, ?, 'queued', 'starting', 'Preparando lançamento...', ?, ?)
    """, (job_id, product_id, product["nome_produto"], video_count, datetime.now().isoformat()))
    conn.execute("UPDATE imported_products SET launch_status='launching' WHERE id=?", (product_id,))
    conn.commit()
    conn.close()

    # Spawn background thread
    t = threading.Thread(target=create_full_campaign, args=(job_id, product, account), daemon=True)
    _launch_threads[job_id] = t
    t.start()

    return {"status": "queued", "job_id": job_id, "product_name": product["nome_produto"]}


@router.get("/api/launcher/job/{job_id}")
def get_launch_job(job_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM launch_jobs WHERE id=?", (job_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Job não encontrado")
    d = dict(row)
    d["ad_ids"] = json.loads(d.get("ad_ids", "[]"))
    # Is thread still alive?
    t = _launch_threads.get(job_id)
    d["thread_alive"] = t.is_alive() if t else False
    return d


@router.get("/api/launcher/jobs")
def list_launch_jobs(limit: int = 50):
    conn = get_db()
    rows = conn.execute("SELECT * FROM launch_jobs ORDER BY started_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["ad_ids"] = json.loads(d.get("ad_ids", "[]"))
        result.append(d)
    return result


@router.delete("/api/launcher/job/{job_id}")
def delete_launch_job(job_id: str):
    conn = get_db()
    conn.execute("DELETE FROM launch_jobs WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}
