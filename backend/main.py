"""
Meta Ads Control Center - Backend API
FastAPI + SQLite - Serves frontend + API
"""
import os, json, uuid, random, requests as http_req, threading, time, hashlib, secrets, hmac, base64
import smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import sqlite3, re as _re
import anthropic
import openai as openai_lib

# Google Sheets API (optional — graceful degradation if not installed)
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build as google_build
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False

# In-memory tracker for background launch threads
_launch_threads: dict = {}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "meta_ads.db")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DATABASE_URL    = os.getenv("DATABASE_URL", "")
SESSION_SECRET  = os.getenv("SESSION_SECRET", "")  # Set on Render for stateless tokens

# ─── PostgreSQL compatibility layer ────────────────────────────────────────────
if DATABASE_URL:
    import psycopg2, psycopg2.extras

    class _PGRow(dict):
        """Dict-based row that also supports integer indexing (like sqlite3.Row)."""
        def __getitem__(self, key):
            if isinstance(key, int):
                return list(self.values())[key]
            return super().__getitem__(key)

    class _PGCursor:
        def __init__(self, cur): self._cur = cur
        def fetchone(self):
            row = self._cur.fetchone()
            return _PGRow(row) if row else None
        def fetchall(self):
            return [_PGRow(r) for r in (self._cur.fetchall() or [])]

    class _PGConn:
        def __init__(self, raw): self._conn = raw

        @staticmethod
        def _adapt(sql):
            sql = sql.replace("?", "%s")
            def _upsert(m):
                table = m.group(1)
                cols = [c.strip() for c in m.group(2).split(",")]
                vals = m.group(3)
                pk = cols[0]
                updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols[1:])
                return (f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({vals}) "
                        f"ON CONFLICT ({pk}) DO UPDATE SET {updates}")
            sql = _re.sub(
                r"INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)",
                _upsert, sql, flags=_re.IGNORECASE)
            return sql

        def execute(self, sql, params=None):
            sql = self._adapt(sql)
            try:
                cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cur.execute(sql, params or ())
                return _PGCursor(cur)
            except Exception:
                self._conn.rollback()
                raise

        def executescript(self, sql):
            cur = self._conn.cursor()
            for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
                try:
                    cur.execute(stmt)
                    self._conn.commit()
                except Exception:
                    self._conn.rollback()

        def commit(self): self._conn.commit()
        def close(self): self._conn.close()
META_API = "https://graph.facebook.com/v19.0"

app = FastAPI(title="Meta Ads Control Center", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── DATABASE ──────────────────────────────────────────────────────────────────

def get_db():
    if DATABASE_URL:
        return _PGConn(psycopg2.connect(DATABASE_URL))
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS business_managers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            bm_id TEXT NOT NULL,
            access_token TEXT NOT NULL,
            status TEXT DEFAULT 'connected',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ad_accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            account_id TEXT NOT NULL,
            bm_id TEXT,
            country TEXT DEFAULT 'BR',
            access_token TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            conditions TEXT NOT NULL,
            action TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            trigger_count INTEGER DEFAULT 0,
            last_run TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            campaign_id TEXT,
            campaign_name TEXT,
            rule_id TEXT,
            rule_name TEXT,
            message TEXT,
            severity TEXT DEFAULT 'warning',
            status TEXT DEFAULT 'active',
            spend REAL DEFAULT 0,
            conversions INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS work_sessions (
            id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            snapshot_before TEXT,
            snapshot_after TEXT,
            diff TEXT,
            status TEXT DEFAULT 'active',
            notes TEXT
        );
        CREATE TABLE IF NOT EXISTS rule_engine_log (
            id TEXT PRIMARY KEY,
            ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rules_checked INTEGER DEFAULT 0,
            campaigns_checked INTEGER DEFAULT 0,
            actions_taken INTEGER DEFAULT 0,
            summary TEXT
        );
        CREATE TABLE IF NOT EXISTS ai_products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cpa_target REAL DEFAULT 0,
            roas_target REAL DEFAULT 0,
            avg_ticket REAL DEFAULT 0,
            countries TEXT DEFAULT '',
            peak_months TEXT DEFAULT '',
            creative_types TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ai_knowledge (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ai_cycles (
            id TEXT PRIMARY KEY,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            status TEXT DEFAULT 'running',
            campaigns_analyzed INTEGER DEFAULT 0,
            actions_taken INTEGER DEFAULT 0,
            insights TEXT DEFAULT '[]',
            alerts_json TEXT DEFAULT '[]',
            raw_analysis TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS ai_decisions (
            id TEXT PRIMARY KEY,
            cycle_id TEXT,
            campaign_id TEXT,
            campaign_name TEXT,
            action TEXT,
            reason TEXT,
            metrics_snapshot TEXT,
            executed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ai_ideas (
            id TEXT PRIMARY KEY,
            product_name TEXT DEFAULT '',
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            why_it_works TEXT DEFAULT '',
            impact TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS agent_config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    # ── Migrations: add columns that may not exist in older DB files ──────────
    _migrations = [
        ("ai_products", "country",       "TEXT DEFAULT ''"),
        ("ai_products", "shopify_code",  "TEXT DEFAULT ''"),
        ("ai_products", "campaign_type", "TEXT DEFAULT ''"),
    ]
    for table, col, definition in _migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
        except Exception:
            pass  # Column already exists
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sheets_config (
            id TEXT PRIMARY KEY,
            spreadsheet_id TEXT NOT NULL,
            service_account_json TEXT NOT NULL,
            config_tab TEXT DEFAULT 'Configurações',
            ads_tab TEXT DEFAULT 'Anúncios',
            last_synced_at TIMESTAMP,
            sync_status TEXT DEFAULT 'never',
            rows_synced INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sheets_accounts (
            id TEXT PRIMARY KEY,
            config_id TEXT NOT NULL UNIQUE,
            ad_account_id TEXT NOT NULL,
            page_id TEXT DEFAULT '',
            access_token TEXT NOT NULL,
            app_id TEXT DEFAULT '',
            app_secret TEXT DEFAULT '',
            pixel_id TEXT NOT NULL,
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS imported_products (
            id TEXT PRIMARY KEY,
            config_id TEXT NOT NULL,
            shopify_id TEXT DEFAULT '',
            nome_produto TEXT NOT NULL,
            url_destino TEXT DEFAULT '',
            texto_principal TEXT DEFAULT '',
            titulo TEXT DEFAULT '',
            descricao TEXT DEFAULT '',
            cta TEXT DEFAULT 'SHOP_NOW',
            urls_videos TEXT DEFAULT '[]',
            paises TEXT DEFAULT '[]',
            idade_min INTEGER DEFAULT 18,
            idade_max INTEGER DEFAULT 65,
            genero TEXT DEFAULT 'ALL',
            budget_diario_usd REAL DEFAULT 10.0,
            horario_inicio TEXT DEFAULT '',
            launch_status TEXT DEFAULT 'not_launched',
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS launch_jobs (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            product_name TEXT DEFAULT '',
            status TEXT DEFAULT 'queued',
            step TEXT DEFAULT '',
            step_detail TEXT DEFAULT '',
            error TEXT DEFAULT '',
            campaign_id TEXT DEFAULT '',
            adset_id TEXT DEFAULT '',
            ad_ids TEXT DEFAULT '[]',
            total_videos INTEGER DEFAULT 0,
            completed_videos INTEGER DEFAULT 0,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS api_connections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            token TEXT NOT NULL,
            token_type TEXT DEFAULT 'full',
            account_id TEXT DEFAULT '',
            bm_id TEXT DEFAULT '',
            user_name TEXT DEFAULT '',
            user_id TEXT DEFAULT '',
            capabilities TEXT DEFAULT '[]',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT DEFAULT '',
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#3b82f6',
            user_id TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS intel_history (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            sources TEXT DEFAULT '[]',
            results_json TEXT DEFAULT '[]',
            synthesis TEXT DEFAULT '',
            result_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    # Migrations: add columns introduced after initial schema
    migrations = [
        "ALTER TABLE alerts ADD COLUMN rule_name TEXT",
        "ALTER TABLE rules ADD COLUMN last_run TIMESTAMP",
        "ALTER TABLE business_managers ADD COLUMN project_id TEXT DEFAULT ''",
        "ALTER TABLE ad_accounts ADD COLUMN project_id TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN notion_token TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN notion_analyses_db_id TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN notion_products_db_id TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN clickup_token TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN clickup_list_id TEXT DEFAULT ''",
    ]
    for m in migrations:
        try:
            conn.execute(m)
            conn.commit()
        except Exception:
            pass  # Column already exists

    # Migration: assign orphaned BMs/accounts (no project_id) to a default project
    try:
        _migrate_orphaned_to_default_project(conn)
    except Exception:
        pass  # Non-fatal — don't crash startup

    conn.close()

def _migrate_orphaned_to_default_project(conn):
    """If there are BMs or accounts with no project_id, assign them to the first project
    (or create a 'Projeto Padrão' if none exists). Runs at startup, idempotent."""
    orphan_bms = conn.execute(
        "SELECT id FROM business_managers WHERE project_id IS NULL OR project_id=''"
    ).fetchall()
    orphan_accs = conn.execute(
        "SELECT id FROM ad_accounts WHERE project_id IS NULL OR project_id=''"
    ).fetchall()
    if not orphan_bms and not orphan_accs:
        return  # Nothing to migrate

    # Find or create a default project
    default_pid = None
    first_project = conn.execute("SELECT id FROM projects ORDER BY created_at LIMIT 1").fetchone()
    if first_project:
        default_pid = first_project["id"]
    else:
        default_pid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO projects (id, name, color) VALUES (?,?,?)",
            (default_pid, "Projeto Padrão", "#3b82f6")
        )
        # Auto-activate if no active project
        active = conn.execute("SELECT value FROM settings WHERE key='active_project_id'").fetchone()
        if not active or not active["value"]:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key,value) VALUES ('active_project_id',?)",
                (default_pid,)
            )

    if orphan_bms:
        conn.execute(
            "UPDATE business_managers SET project_id=? WHERE project_id IS NULL OR project_id=''",
            (default_pid,)
        )
    if orphan_accs:
        conn.execute(
            "UPDATE ad_accounts SET project_id=? WHERE project_id IS NULL OR project_id=''",
            (default_pid,)
        )
    conn.commit()

def get_setting(key: str, default: str = "") -> str:
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default

def _get_active_accounts(conn) -> list:
    """Return ad accounts filtered by the currently active project."""
    active = get_setting("active_project_id", "")
    if active:
        return conn.execute("SELECT * FROM ad_accounts WHERE project_id=?", (active,)).fetchall()
    return conn.execute("SELECT * FROM ad_accounts").fetchall()

# ─── META API LAYER ────────────────────────────────────────────────────────────

def meta_get(path: str, token: str, params: dict = None) -> dict:
    """Call Meta Graph API GET endpoint."""
    url = f"{META_API}/{path.lstrip('/')}"
    p = {"access_token": token, **(params or {})}
    try:
        r = http_req.get(url, params=p, timeout=15)
        data = r.json()
        if "error" in data:
            return {"error": data["error"]}
        return data
    except Exception as e:
        return {"error": str(e)}

def meta_post(path: str, token: str, payload: dict = None) -> dict:
    """Call Meta Graph API POST endpoint."""
    url = f"{META_API}/{path.lstrip('/')}"
    try:
        r = http_req.post(url, data={"access_token": token, **(payload or {})}, timeout=15)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def fetch_meta_campaigns(account_id: str, token: str) -> list:
    """Fetch real campaigns from Meta API for an ad account."""
    clean_id = account_id.replace("act_", "")
    data = meta_get(
        f"act_{clean_id}/campaigns",
        token,
        {"fields": "id,name,status,daily_budget,lifetime_budget,objective", "limit": 200}
    )
    if "error" in data:
        return []
    return data.get("data", [])

def fetch_meta_insights(campaign_id: str, token: str, date_preset: str = "last_7d") -> dict:
    """Fetch campaign insights from Meta API — full metric set."""
    data = meta_get(
        f"{campaign_id}/insights",
        token,
        {"fields": _META_INSIGHT_FIELDS, "date_preset": date_preset}
    )
    if "error" in data or not data.get("data"):
        return {}
    return _parse_campaign_insights(data["data"][0])

def pause_meta_campaign(campaign_id: str, token: str) -> bool:
    """Pause a campaign on Meta."""
    r = meta_post(campaign_id, token, {"status": "PAUSED"})
    return "error" not in r

def activate_meta_campaign(campaign_id: str, token: str) -> bool:
    """Activate a campaign on Meta."""
    r = meta_post(campaign_id, token, {"status": "ACTIVE"})
    return "error" not in r

def verify_meta_token(token: str, bm_id: str = "") -> dict:
    """Verify a Meta access token."""
    r = meta_get("me", token, {"fields": "id,name"})
    if "error" in r:
        return {"valid": False, "error": r["error"]}
    return {"valid": True, "name": r.get("name", ""), "id": r.get("id", "")}

# ─── META CAMPAIGN CREATOR ─────────────────────────────────────────────────────

def meta_post_json(path: str, token: str, payload: dict = None) -> dict:
    """Call Meta Graph API POST with JSON body (needed for targeting objects)."""
    url = f"{META_API}/{path.lstrip('/')}"
    try:
        p = payload or {}
        p["access_token"] = token
        r = http_req.post(url, json=p, timeout=30)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

CTA_MAP = {
    "SHOP_NOW": "SHOP_NOW", "COMPRAR": "SHOP_NOW",
    "LEARN_MORE": "LEARN_MORE", "SAIBA MAIS": "LEARN_MORE",
    "SIGN_UP": "SIGN_UP", "CADASTRE-SE": "SIGN_UP",
    "GET_OFFER": "GET_OFFER", "VER OFERTA": "GET_OFFER",
    "BUY_NOW": "BUY_NOW", "COMPRAR AGORA": "BUY_NOW",
    "BOOK_NOW": "BOOK_NOW", "AGENDAR": "BOOK_NOW",
}

COUNTRY_NAMES = {
    "BR": "Brazil", "US": "United States", "MX": "Mexico",
    "AR": "Argentina", "CL": "Chile", "CO": "Colombia",
    "PE": "Peru", "EC": "Ecuador", "UY": "Uruguay",
    "PY": "Paraguay", "BO": "Bolivia", "VE": "Venezuela",
    "ES": "Spain", "PT": "Portugal",
}

def _db_update_job(job_id: str, **kwargs):
    """Thread-safe job status update."""
    conn = get_db()
    sets = ", ".join(f"{k}=?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE launch_jobs SET {sets} WHERE id=?", vals)
    conn.commit()
    conn.close()

def poll_video_ready(video_id: str, token: str, max_wait: int = 180) -> bool:
    """Poll Meta API until video is ready or timeout."""
    waited = 0
    while waited < max_wait:
        time.sleep(10)
        waited += 10
        data = meta_get(f"{video_id}", token, {"fields": "status"})
        if "error" in data:
            return False
        video_status = data.get("status", {})
        processing = video_status.get("video_status", "")
        if processing == "ready":
            return True
    return False

def _get_video_filename(url: str, fallback: str) -> str:
    """HEAD request to Google Drive to get the filename from Content-Disposition."""
    try:
        r = http_req.head(url, allow_redirects=True, timeout=10)
        cd = r.headers.get("Content-Disposition", "")
        if "filename=" in cd:
            fname = cd.split("filename=")[-1].strip().strip('"').strip("'")
            name, _ = os.path.splitext(fname)
            return name if name else fallback
    except Exception:
        pass
    return fallback

def create_full_campaign(job_id: str, product: dict, account: dict):
    """
    Background thread: replicates the n8n workflow.
    Creates campaign → adset → (per video) upload + wait + creative + ad
    """
    token = account["access_token"]
    act = f"act_{account['ad_account_id'].replace('act_', '')}"
    page_id = account.get("page_id", "")
    pixel_id = account.get("pixel_id", "")
    video_urls = json.loads(product.get("urls_videos", "[]"))
    countries = json.loads(product.get("paises", "[]")) or ["BR"]
    nome = product.get("nome_produto", "Produto")
    budget_cents = int(float(product.get("budget_diario_usd", 10.0)) * 100)
    cta = CTA_MAP.get(product.get("cta", "SHOP_NOW").upper(), "SHOP_NOW")

    # Campaign name: [MX] [ABO] [NOME PRODUTO] [DD/MM]
    first_country = countries[0] if countries else "BR"
    today_str = datetime.now().strftime("%d/%m")
    nome_upper = nome.upper()
    shopify_id = product.get("shopify_id", "")
    camp_name = f"[{first_country}] [ABO] [{nome_upper}] [{today_str}]"
    if shopify_id:
        camp_name += f" - [{shopify_id}]"

    # Adset name: [GENERO] [18-65] [PAÍS] [budget]
    gender_raw = product.get("genero", "ALL").upper()
    genero_label = {"M": "HOMENS", "F": "MULHERES", "ALL": "TODOS", "TODOS": "TODOS",
                    "HOMENS": "HOMENS", "MULHERES": "MULHERES"}.get(gender_raw, "TODOS")
    age_min = product.get("idade_min", 18)
    age_max = product.get("idade_max", 65)
    country_name = COUNTRY_NAMES.get(first_country, first_country)
    budget_fmt = f"{product.get('budget_diario_usd', 10.0):.2f}".replace(".", ",")
    adset_name = f"[{genero_label}] [{age_min}-{age_max}] [{country_name.upper()}] [{budget_fmt}]"

    # Targeting
    targeting = {
        "geo_locations": {"countries": countries},
        "age_min": age_min,
        "age_max": age_max,
        "publisher_platforms": ["facebook", "instagram"],
        "facebook_positions": ["feed", "story", "reels"],
        "instagram_positions": ["stream", "story", "reels"],
    }
    gender_map = {"M": [1], "HOMENS": [1], "F": [2], "MULHERES": [2]}
    if gender_raw in gender_map:
        targeting["genders"] = gender_map[gender_raw]

    try:
        # ── Step 1: Create Campaign ──
        _db_update_job(job_id, status="running", step="creating_campaign", step_detail=f"Criando campanha: {camp_name}")
        camp_payload = {
            "name": camp_name,
            "objective": "OUTCOME_SALES",
            "status": "PAUSED",
            "special_ad_categories": [],
        }
        camp_r = meta_post(f"{act}/campaigns", token, camp_payload)
        if "error" in camp_r:
            raise Exception(f"Erro ao criar campanha: {camp_r['error']}")
        campaign_id = camp_r.get("id", "")
        _db_update_job(job_id, campaign_id=campaign_id)

        # ── Step 2: Create Ad Set ──
        _db_update_job(job_id, step="creating_adset", step_detail=f"Criando conjunto: {adset_name}")
        # Start time: next day at horario_inicio
        start_time_str = product.get("horario_inicio", "00:00")
        try:
            h, m = [int(x) for x in start_time_str.split(":")]
        except Exception:
            h, m = 0, 0
        start_dt = (datetime.now() + timedelta(days=1)).replace(hour=h, minute=m, second=0, microsecond=0)
        start_time_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S+0000")

        adset_payload = {
            "name": adset_name,
            "campaign_id": campaign_id,
            "daily_budget": str(budget_cents),
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "OFFSITE_CONVERSIONS",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "promoted_object": json.dumps({"pixel_id": pixel_id, "custom_event_type": "PURCHASE"}),
            "targeting": json.dumps(targeting),
            "status": "PAUSED",
            "start_time": start_time_iso,
        }
        adset_r = meta_post(f"{act}/adsets", token, adset_payload)
        if "error" in adset_r:
            raise Exception(f"Erro ao criar conjunto: {adset_r['error']}")
        adset_id = adset_r.get("id", "")
        _db_update_job(job_id, adset_id=adset_id, total_videos=len(video_urls))

        # ── Steps 3-7: For each video ──
        ad_ids = []
        for idx, video_url in enumerate(video_urls):
            n = idx + 1
            fallback_name = f"{nome}_{n}"

            # Get filename
            _db_update_job(job_id, step=f"fetching_video_{n}_of_{len(video_urls)}",
                           step_detail=f"Obtendo nome do vídeo {n}/{len(video_urls)}")
            video_name = _get_video_filename(video_url, fallback_name)

            # Upload video
            _db_update_job(job_id, step=f"uploading_video_{n}_of_{len(video_urls)}",
                           step_detail=f"Enviando vídeo {n}/{len(video_urls)}: {video_name}")
            upload_r = meta_post(f"{act}/advideos", token, {"file_url": video_url, "name": video_name})
            if "error" in upload_r:
                _db_update_job(job_id, step_detail=f"Erro no vídeo {n} — continuando: {upload_r['error']}")
                continue
            video_id = upload_r.get("id", "")

            # Wait for video ready
            _db_update_job(job_id, step=f"waiting_video_{n}_of_{len(video_urls)}",
                           step_detail=f"Aguardando processamento do vídeo {n}/{len(video_urls)}...")
            ready = poll_video_ready(video_id, token)
            if not ready:
                _db_update_job(job_id, step_detail=f"Timeout no vídeo {n} — continuando")
                continue

            # Create Ad Creative
            _db_update_job(job_id, step=f"creating_creative_{n}_of_{len(video_urls)}",
                           step_detail=f"Criando criativo {n}/{len(video_urls)}")
            object_story_spec = {
                "page_id": page_id,
                "video_data": {
                    "video_id": video_id,
                    "message": product.get("texto_principal", ""),
                    "title": product.get("titulo", ""),
                    "link_description": product.get("descricao", ""),
                    "call_to_action": {
                        "type": cta,
                        "value": {"link": product.get("url_destino", "")},
                    },
                },
            }
            creative_r = meta_post(f"{act}/adcreatives", token, {
                "name": f"{video_name}_creative",
                "object_story_spec": json.dumps(object_story_spec),
            })
            if "error" in creative_r:
                _db_update_job(job_id, step_detail=f"Erro no criativo {n}: {creative_r['error']}")
                continue
            creative_id = creative_r.get("id", "")

            # Create Ad
            _db_update_job(job_id, step=f"creating_ad_{n}_of_{len(video_urls)}",
                           step_detail=f"Criando anúncio {n}/{len(video_urls)}: {video_name}")
            ad_r = meta_post(f"{act}/ads", token, {
                "name": video_name,
                "adset_id": adset_id,
                "creative": json.dumps({"creative_id": creative_id}),
                "status": "PAUSED",
            })
            if "error" not in ad_r:
                ad_ids.append(ad_r.get("id", ""))

            _db_update_job(job_id, completed_videos=n, ad_ids=json.dumps(ad_ids))

        # ── Done ──
        _db_update_job(job_id, status="completed", step="done",
                       step_detail=f"Concluído! {len(ad_ids)} anúncios criados.",
                       ad_ids=json.dumps(ad_ids), completed_at=datetime.now().isoformat())
        # Update product status
        conn = get_db()
        conn.execute("UPDATE imported_products SET launch_status='launched' WHERE id=?", (product["id"],))
        conn.commit()
        conn.close()

    except Exception as ex:
        _db_update_job(job_id, status="failed", step="error",
                       step_detail=str(ex), error=str(ex),
                       completed_at=datetime.now().isoformat())
        conn = get_db()
        conn.execute("UPDATE imported_products SET launch_status='failed' WHERE id=?", (product["id"],))
        conn.commit()
        conn.close()

# ─── GOOGLE SHEETS SYNC ─────────────────────────────────────────────────────────

def _build_sheets_client(service_account_json: str):
    """Build Google Sheets API client from service account JSON string."""
    if not GOOGLE_AVAILABLE:
        raise Exception("Biblioteca google-api-python-client não instalada. Execute: pip install google-auth google-api-python-client")
    sa_info = json.loads(service_account_json)
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = service_account.Credentials.from_service_account_info(sa_info, scopes=scopes)
    return google_build("sheets", "v4", credentials=creds, cache_discovery=False)

def _sheets_get_rows(service, spreadsheet_id: str, tab: str) -> list:
    """Fetch all rows from a sheet tab."""
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{tab}"
    ).execute()
    return result.get("values", [])

def sync_sheets_to_db(config: dict) -> dict:
    """Read Google Sheets and upsert into sheets_accounts + imported_products."""
    svc = _build_sheets_client(config["service_account_json"])
    spreadsheet_id = config["spreadsheet_id"]
    config_tab = config.get("config_tab", "Configurações")
    ads_tab = config.get("ads_tab", "Anúncios")

    conn = get_db()
    synced_accounts = 0
    synced_products = 0

    # ── Sync Configurações tab ──
    cfg_rows = _sheets_get_rows(svc, spreadsheet_id, config_tab)
    if cfg_rows:
        headers = [h.strip() for h in cfg_rows[0]]
        def col(row, name, default=""):
            try:
                idx = headers.index(name)
                return row[idx] if idx < len(row) else default
            except ValueError:
                return default

        for row in cfg_rows[1:]:
            if not row or not row[0].strip():
                continue
            cid = col(row, "Config_ID")
            if not cid:
                continue
            conn.execute("""
                INSERT INTO sheets_accounts (id, config_id, ad_account_id, page_id, access_token, app_id, app_secret, pixel_id, last_synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(config_id) DO UPDATE SET
                    ad_account_id=excluded.ad_account_id,
                    page_id=excluded.page_id,
                    access_token=excluded.access_token,
                    app_id=excluded.app_id,
                    app_secret=excluded.app_secret,
                    pixel_id=excluded.pixel_id,
                    last_synced_at=excluded.last_synced_at
            """, (
                str(uuid.uuid4()), cid,
                col(row, "Ad Account ID"),
                col(row, "Page ID"),
                col(row, "Access Token"),
                col(row, "App ID"),
                col(row, "App Secret"),
                col(row, "Pixel ID"),
                datetime.now().isoformat(),
            ))
            synced_accounts += 1

    # ── Sync Anúncios tab ──
    ads_rows = _sheets_get_rows(svc, spreadsheet_id, ads_tab)
    if ads_rows:
        headers_ads = [h.strip() for h in ads_rows[0]]
        def cola(row, name, default=""):
            try:
                idx = headers_ads.index(name)
                return row[idx] if idx < len(row) else default
            except ValueError:
                return default

        for row in ads_rows[1:]:
            if not row or not row[0].strip() and (len(row) < 2 or not row[1].strip()):
                continue
            cid = cola(row, "Config_ID")
            nome = cola(row, "Nome_Produto")
            if not cid or not nome:
                continue

            # Parse video URLs (one per line — Alt+Enter in Sheets sends \n)
            raw_videos = cola(row, "URLs_Videos", "")
            video_list = [v.strip() for v in raw_videos.replace("\r", "").split("\n") if v.strip()]
            if not video_list:
                video_list = [v.strip() for v in raw_videos.split(",") if v.strip()]

            # Parse countries
            raw_paises = cola(row, "Paises", "BR")
            paises_list = [p.strip() for p in raw_paises.replace(" ", "").split(",") if p.strip()]

            # Natural key: config_id + shopify_id (or config_id + nome if no shopify_id)
            shopify_id = cola(row, "ID_Shopify", "")
            natural_key = f"{cid}__{shopify_id or nome}"

            existing = conn.execute("SELECT id FROM imported_products WHERE id=?", (natural_key,)).fetchone()
            if existing:
                conn.execute("""
                    UPDATE imported_products SET
                        config_id=?, shopify_id=?, nome_produto=?, url_destino=?,
                        texto_principal=?, titulo=?, descricao=?, cta=?,
                        urls_videos=?, paises=?, idade_min=?, idade_max=?,
                        genero=?, budget_diario_usd=?, horario_inicio=?, last_synced_at=?
                    WHERE id=?
                """, (
                    cid, shopify_id, nome, cola(row, "URL_Destino"),
                    cola(row, "Texto_Principal"), cola(row, "Titulo"),
                    cola(row, "Descricao"), cola(row, "CTA", "SHOP_NOW"),
                    json.dumps(video_list), json.dumps(paises_list),
                    int(cola(row, "Idade_Min", "18") or 18),
                    int(cola(row, "Idade_Max", "65") or 65),
                    cola(row, "Genero", "ALL"),
                    float(cola(row, "Budget_Diario_USD", "10") or 10),
                    cola(row, "Horario_Inicio", ""),
                    datetime.now().isoformat(), natural_key,
                ))
            else:
                conn.execute("""
                    INSERT INTO imported_products
                    (id, config_id, shopify_id, nome_produto, url_destino, texto_principal, titulo, descricao, cta,
                     urls_videos, paises, idade_min, idade_max, genero, budget_diario_usd, horario_inicio,
                     launch_status, last_synced_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_launched', ?, ?)
                """, (
                    natural_key, cid, shopify_id, nome,
                    cola(row, "URL_Destino"), cola(row, "Texto_Principal"),
                    cola(row, "Titulo"), cola(row, "Descricao"),
                    cola(row, "CTA", "SHOP_NOW"),
                    json.dumps(video_list), json.dumps(paises_list),
                    int(cola(row, "Idade_Min", "18") or 18),
                    int(cola(row, "Idade_Max", "65") or 65),
                    cola(row, "Genero", "ALL"),
                    float(cola(row, "Budget_Diario_USD", "10") or 10),
                    cola(row, "Horario_Inicio", ""),
                    datetime.now().isoformat(), datetime.now().isoformat(),
                ))
            synced_products += 1

    conn.commit()
    conn.close()
    return {"synced_accounts": synced_accounts, "synced_products": synced_products}

# ─── BM ACCOUNT SYNC ──────────────────────────────────────────────────────────

# Status code 1 = ACTIVE in Meta API
_ACCT_STATUS_MAP = {1: "active", 2: "disabled", 3: "unsettled", 9: "in_grace_period", 101: "closed"}

def fetch_bm_ad_accounts(bm_id: str, token: str) -> list:
    """Fetch all ad accounts linked to a BM (owned + client), deduplicated."""
    accounts = []
    for endpoint in [f"{bm_id}/owned_ad_accounts", f"{bm_id}/client_ad_accounts"]:
        data = meta_get(endpoint, token, {"fields": "id,name,account_status,currency,timezone_name", "limit": 200})
        if "data" in data:
            accounts += data["data"]
    seen, unique = set(), []
    for a in accounts:
        if a.get("id") and a["id"] not in seen:
            seen.add(a["id"])
            unique.append(a)
    return unique

def _sync_bm_accounts(bm_row_id: str, bm_id: str, token: str, conn, project_id: str = "") -> int:
    """Fetch and upsert all accounts for a BM. Returns count of accounts imported."""
    raw_accounts = fetch_bm_ad_accounts(bm_id, token)
    count = 0
    for ra in raw_accounts:
        act_id = ra["id"].replace("act_", "")
        existing = conn.execute("SELECT id, project_id FROM ad_accounts WHERE account_id=?", (f"act_{act_id}",)).fetchone()
        status = _ACCT_STATUS_MAP.get(ra.get("account_status", 1), "active")
        if existing:
            conn.execute(
                "UPDATE ad_accounts SET name=?, bm_id=?, status=?, project_id=? WHERE account_id=?",
                (ra.get("name", f"act_{act_id}"), bm_row_id, status, project_id or existing["project_id"] or "", f"act_{act_id}")
            )
        else:
            conn.execute(
                "INSERT INTO ad_accounts (id, name, account_id, bm_id, country, access_token, status, project_id) VALUES (?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), ra.get("name", f"act_{act_id}"), f"act_{act_id}",
                 bm_row_id, "", token, status, project_id)
            )
            count += 1
    return count

def gen_time_series(days=7):
    data = []
    base_inv = random.uniform(1500, 2500)
    base_conv = random.randint(30, 60)
    for i in range(days):
        d = datetime.now() - timedelta(days=days - i - 1)
        inv = round(base_inv * random.uniform(0.7, 1.3), 2)
        conv = int(base_conv * random.uniform(0.7, 1.3))
        data.append({
            "date": d.strftime("%d/%m"),
            "invest": inv,
            "conversions": conv,
            "roas": round(conv * 35 / inv, 2) if inv > 0 else 0,
        })
    return data

# ─── RULE ENGINE ───────────────────────────────────────────────────────────────

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

# ─── AI RULE PARSER ────────────────────────────────────────────────────────────

AI_RULE_SYSTEM = """Você é um assistente especialista em Meta Ads. O usuário vai descrever uma regra de automação em linguagem natural e você deve convertê-la em JSON estruturado.

Métricas disponíveis:
- spend: gasto em dólares
- spend_pct: percentual do budget gasto
- conversions: número de conversões/vendas
- checkouts: número de checkouts iniciados
- roas: retorno sobre investimento (ex: 2.5)
- cpa: custo por aquisição em dólares
- ctr: taxa de clique em %
- running_hours: horas rodando
- budget_remaining: budget restante em dólares
- time_of_day: hora do dia (0-23)
- day_of_week: dia da semana (0=domingo, 6=sábado)

Operadores disponíveis: >=, <=, ==, >, <

Ações disponíveis:
- pause: pausar campanha
- notify: apenas notificar/alertar
- activate: ativar campanha
- budget: reduzir orçamento

Retorne APENAS um JSON válido neste formato (sem explicações, sem markdown):
{
  "name": "Nome curto e descritivo da regra",
  "conditions": [
    {"metric": "spend", "operator": ">=", "value": 5},
    {"metric": "conversions", "operator": "==", "value": 0}
  ],
  "action": "pause"
}

Regras para converter:
- "gastar X sem conversões" → spend >= X E conversions == 0 → pause
- "ROAS abaixo de X" → roas < X → notify ou pause
- "CPA acima de X" → cpa > X → notify
- "gastou X% do budget sem checkout" → spend_pct >= X E checkouts == 0 → pause
- Múltiplas condições devem ser todas em conditions[]"""

def _strip_json(raw: str) -> str:
    """Remove markdown code fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()

def parse_rule_with_anthropic(text: str, api_key: str) -> dict:
    """Use Claude (Anthropic) to parse natural language into a rule JSON."""
    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=AI_RULE_SYSTEM,
            messages=[{"role": "user", "content": text}]
        )
        return json.loads(_strip_json(msg.content[0].text))
    except json.JSONDecodeError as e:
        raise ValueError(f"IA retornou JSON inválido: {e}")
    except anthropic.AuthenticationError:
        raise ValueError("Chave Anthropic inválida. Verifique em Configurações → Integrações.")
    except Exception as e:
        raise ValueError(str(e))

def parse_rule_with_openai(text: str, api_key: str, model: str = "gpt-4o-mini") -> dict:
    """Use OpenAI GPT to parse natural language into a rule JSON."""
    try:
        client = openai_lib.OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            max_tokens=512,
            messages=[
                {"role": "system", "content": AI_RULE_SYSTEM},
                {"role": "user", "content": text},
            ],
        )
        return json.loads(_strip_json(resp.choices[0].message.content))
    except json.JSONDecodeError as e:
        raise ValueError(f"IA retornou JSON inválido: {e}")
    except openai_lib.AuthenticationError:
        raise ValueError("Chave OpenAI inválida. Verifique em Configurações → Integrações.")
    except Exception as e:
        raise ValueError(str(e))

def parse_rule_with_ai(text: str, provider: str, api_key: str) -> dict:
    """Route to the correct AI provider."""
    if provider == "openai":
        return parse_rule_with_openai(text, api_key)
    return parse_rule_with_anthropic(text, api_key)

# ─── API ROUTES ────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    conn = get_db()
    acc_count = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0]
    conn.close()
    if acc_count == 0:
        return {
            "total_investment": 0, "total_conversions": 0, "avg_roas": 0,
            "active_alerts": 0, "investment_change": 0,
            "conversions_change": 0, "roas_change": 0, "alerts_change": 0,
        }
    # Real: aggregate from campaigns
    campaigns = _fetch_all_campaigns_cached()
    total_spend = sum(c.get("spend", 0) for c in campaigns)
    total_conv = sum(c.get("conversions", 0) for c in campaigns)
    total_revenue = sum(c.get("revenue", 0) for c in campaigns)
    avg_roas = round(total_revenue / total_spend, 2) if total_spend > 0 else 0
    return {
        "total_investment": round(total_spend, 2),
        "total_conversions": total_conv,
        "avg_roas": avg_roas,
        "active_alerts": 0,
        "investment_change": 0,
        "conversions_change": 0,
        "roas_change": 0,
        "alerts_change": 0,
    }

# ── Dashboard cache to avoid hitting Meta API on every request ─────────────
_dashboard_cache = {"data": None, "ts": 0}

def _fetch_all_campaigns_cached(ttl: int = 300):
    """Fetch all campaigns with insights, cached for `ttl` seconds."""
    import time as _time
    now = _time.time()
    if _dashboard_cache["data"] is not None and (now - _dashboard_cache["ts"]) < ttl:
        return _dashboard_cache["data"]

    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return []

    all_campaigns = []
    for acc in accounts:
        acc_d = dict(acc)
        meta_camps = fetch_meta_campaigns(acc_d["account_id"], acc_d["access_token"])
        for mc in meta_camps:
            insights = fetch_meta_insights(mc["id"], acc_d["access_token"])
            camp = {
                "id": mc["id"],
                "name": mc["name"],
                "account": acc_d["name"],
                "account_id": acc_d["id"],
                "country": acc_d.get("country", ""),
                "status": mc.get("status", "UNKNOWN").lower(),
                "spend": insights.get("spend", 0),
                "conversions": insights.get("conversions", 0),
                "revenue": insights.get("revenue", 0),
                "roas": insights.get("roas", 0),
                "cpa": insights.get("cpa", 0),
                "ctr": insights.get("ctr", 0),
            }
            all_campaigns.append(camp)

    _dashboard_cache["data"] = all_campaigns
    _dashboard_cache["ts"] = now
    return all_campaigns

_PERIOD_DAYS = {"today": 1, "yesterday": 1, "last_7d": 7, "last_14d": 14, "last_30d": 30, "last_90d": 90}

@app.get("/api/dashboard")
def get_dashboard(period: str = "last_7d", view_by: str = "account"):
    conn = get_db()
    acc_count = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0]
    conn.close()

    if acc_count == 0:
        return {
            "demo": False,
            "stats": {"total_investment": 0, "total_conversions": 0, "avg_roas": 0, "active_alerts": 0, "investment_change": 0, "conversions_change": 0, "roas_change": 0},
            "time_series": [],
            "by_account": [],
            "by_product": [],
            "by_country": [],
            "campaigns": [],
        }

    # ── Real mode — aggregate from Meta API ─────────────────────────────────
    campaigns = _fetch_all_campaigns_cached()
    total_spend = sum(c.get("spend", 0) for c in campaigns)
    total_conv = sum(c.get("conversions", 0) for c in campaigns)
    total_revenue = sum(c.get("revenue", 0) for c in campaigns)
    avg_roas = round(total_revenue / total_spend, 2) if total_spend > 0 else 0

    # By account
    by_account = {}
    for c in campaigns:
        acc = c["account"]
        if acc not in by_account:
            by_account[acc] = {"name": acc, "account_id": c["account_id"], "country": c["country"], "spend": 0, "conversions": 0, "revenue": 0}
        by_account[acc]["spend"] += c.get("spend", 0)
        by_account[acc]["conversions"] += c.get("conversions", 0)
        by_account[acc]["revenue"] += c.get("revenue", 0)
    for a in by_account.values():
        a["roas"] = round(a["revenue"] / a["spend"], 2) if a["spend"] > 0 else 0
        a["cpa"] = round(a["spend"] / a["conversions"], 2) if a["conversions"] > 0 else 0
        a["spend"] = round(a["spend"], 2)

    # By country
    by_country = {}
    for c in campaigns:
        ct = c.get("country", "??")
        if ct not in by_country:
            by_country[ct] = {"name": ct, "invest": 0, "conversions": 0}
        by_country[ct]["invest"] += c.get("spend", 0)
        by_country[ct]["conversions"] += c.get("conversions", 0)
    for v in by_country.values():
        v["invest"] = round(v["invest"], 2)

    return {
        "demo": False,
        "stats": {
            "total_investment": round(total_spend, 2),
            "total_conversions": total_conv,
            "avg_roas": avg_roas,
            "active_alerts": 0,
            "investment_change": 0,
            "conversions_change": 0,
            "roas_change": 0,
        },
        "time_series": gen_time_series(_PERIOD_DAYS.get(period, 7)),
        "by_account": list(by_account.values()),
        "by_country": list(by_country.values()),
        "campaigns": campaigns,
    }

# ─── Business Managers ────────────────────────────────────────────────────────

@app.get("/api/bm")
def list_bms(project_id: str = ""):
    conn = get_db()
    active_project = project_id or get_setting("active_project_id", "")
    if active_project:
        rows = conn.execute("SELECT * FROM business_managers WHERE project_id=?", (active_project,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM business_managers").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["access_token"] = "***"
        result.append(d)
    return result

@app.post("/api/bm")
def add_bm(data: dict):
    conn = get_db()
    bid = str(uuid.uuid4())
    project_id = data.get("project_id") or get_setting("active_project_id", "")
    conn.execute(
        "INSERT INTO business_managers (id, name, bm_id, access_token, project_id) VALUES (?,?,?,?,?)",
        (bid, data["name"], data["bm_id"], data["access_token"], project_id),
    )
    # Auto-sync ad accounts linked to this BM (inherit project_id)
    imported = 0
    try:
        imported = _sync_bm_accounts(bid, data["bm_id"], data["access_token"], conn, project_id)
    except Exception:
        pass
    conn.commit()
    conn.close()
    msg = f"BM adicionado com sucesso!"
    if imported > 0:
        msg = f"BM adicionado! {imported} conta(s) de anúncio importada(s) automaticamente."
    return {"id": bid, "status": "success", "message": msg, "accounts_imported": imported}

@app.post("/api/bm/{bm_id}/sync-accounts")
def sync_bm_accounts(bm_id: str):
    """Manually re-sync all ad accounts for a BM."""
    conn = get_db()
    row = conn.execute("SELECT * FROM business_managers WHERE id=?", (bm_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "BM não encontrado")
    d = dict(row)
    imported = 0
    try:
        imported = _sync_bm_accounts(bm_id, d["bm_id"], d["access_token"], conn, d.get("project_id", ""))
    except Exception as e:
        conn.close()
        raise HTTPException(500, str(e))
    conn.commit()
    conn.close()
    return {"status": "success", "accounts_imported": imported, "message": f"{imported} conta(s) sincronizada(s)."}

@app.put("/api/bm/{bm_id}")
def update_bm(bm_id: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE business_managers SET name=?, bm_id=?, status='connected' WHERE id=?",
        (data.get("name"), data.get("bm_id"), bm_id),
    )
    if data.get("access_token"):
        conn.execute("UPDATE business_managers SET access_token=? WHERE id=?", (data["access_token"], bm_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/bm/{bm_id}")
def delete_bm(bm_id: str):
    conn = get_db()
    conn.execute("DELETE FROM business_managers WHERE id=?", (bm_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/bm/test")
def test_bm_connection(data: dict):
    token = data.get("access_token", "")
    if not token or token == "***":
        return {"status": "error", "message": "Token não fornecido."}
    result = verify_meta_token(token, data.get("bm_id", ""))
    if result["valid"]:
        return {"status": "success", "message": f"Conectado como: {result.get('name', 'OK')}"}
    return {"status": "error", "message": "Token inválido. Verifique o access token."}

# ─── Ad Accounts ──────────────────────────────────────────────────────────────

@app.get("/api/accounts")
def list_accounts():
    conn = get_db()
    rows = _get_active_accounts(conn)
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["access_token"] = "***"
        result.append(d)
    return result

@app.post("/api/accounts")
def add_account(data: dict):
    conn = get_db()
    aid = str(uuid.uuid4())
    project_id = data.get("project_id") or get_setting("active_project_id", "")
    conn.execute(
        "INSERT INTO ad_accounts (id, name, account_id, bm_id, country, access_token, project_id) VALUES (?,?,?,?,?,?,?)",
        (aid, data["name"], data["account_id"], data.get("bm_id"), data.get("country", "BR"), data["access_token"], project_id),
    )
    conn.commit()
    conn.close()
    return {"id": aid, "status": "success", "message": "Conta adicionada com sucesso!"}

@app.put("/api/accounts/{acc_id}")
def update_account(acc_id: str, data: dict):
    conn = get_db()
    if data.get("access_token"):
        conn.execute("UPDATE ad_accounts SET access_token=?, status='active' WHERE id=?", (data["access_token"], acc_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/accounts/{acc_id}")
def delete_account(acc_id: str):
    conn = get_db()
    conn.execute("DELETE FROM ad_accounts WHERE id=?", (acc_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/accounts/test")
def test_account_connection(data: dict):
    token = data.get("access_token", "")
    account_id = data.get("account_id", "")
    if not token or not account_id:
        return {"status": "error", "message": "Token e ID da conta são obrigatórios."}
    campaigns = fetch_meta_campaigns(account_id, token)
    if campaigns:
        return {"status": "success", "message": f"Conectado! {len(campaigns)} campanha(s) encontrada(s)."}
    result = verify_meta_token(token)
    if result["valid"]:
        return {"status": "success", "message": f"Token válido ({result.get('name','')}) — conta pode estar sem campanhas."}
    return {"status": "error", "message": "Não foi possível verificar a conta. Verifique o token."}


def _insights_field(period: str, date_from: str = "", date_to: str = "", metrics: str = "spend,impressions,clicks,ctr,actions,action_values") -> str:
    """Build the Meta API inline insights field string for a period or custom range."""
    if period == "custom" and date_from and date_to:
        return f'insights.time_range({{"since":"{date_from}","until":"{date_to}"}}){{{metrics}}}'
    return f"insights.date_preset({period}){{{metrics}}}"


def _insights_params(period: str, date_from: str = "", date_to: str = "") -> dict:
    """Build query params for a standalone /insights call (not inline)."""
    # NOTE: _META_INSIGHT_FIELDS is defined after _parse_campaign_insights below;
    # Python resolves this at call time so no forward-reference issue.
    fields = _META_INSIGHT_FIELDS
    if period == "custom" and date_from and date_to:
        return {"fields": fields, "time_range": json.dumps({"since": date_from, "until": date_to})}
    return {"fields": fields, "date_preset": period}


_EMPTY_METRICS = {
    "spend": 0, "revenue": 0, "impressions": 0, "reach": 0,
    "clicks": 0, "link_clicks": 0, "ctr": 0,
    "connect_rate": 0, "lp_view_rate": 0, "checkout_per_lpv": 0, "purchase_per_ic": 0,
    "cpc_link": 0, "cost_per_lp": 0, "cpa": 0, "cost_per_checkout": 0,
    "lpv": 0, "checkouts": 0, "conversions": 0,
    "video_3s": 0, "video_thru": 0, "roas": 0,
}


def _fetch_account_insights(account_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch aggregated account-level insights from Meta API."""
    params = _insights_params(period, date_from, date_to)
    data = meta_get(f"{account_id}/insights", token, params)
    rows = data.get("data", [])
    return _parse_campaign_insights(rows[0]) if rows else dict(_EMPTY_METRICS)


def _fetch_campaign_insights_breakdown(account_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch per-campaign insights breakdown from account. Returns {campaign_id: metrics_dict}."""
    params = _insights_params(period, date_from, date_to)
    params["level"] = "campaign"
    params["fields"] = "campaign_id," + _META_INSIGHT_FIELDS
    data = meta_get(f"{account_id}/insights", token, params)
    result = {}
    for row in data.get("data", []):
        cid = row.get("campaign_id")
        if cid:
            result[cid] = _parse_campaign_insights(row)
    return result


def _fetch_adset_insights_breakdown(campaign_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch per-adset insights breakdown from campaign. Returns {adset_id: metrics_dict}."""
    params = _insights_params(period, date_from, date_to)
    params["level"] = "adset"
    params["fields"] = "adset_id," + _META_INSIGHT_FIELDS
    data = meta_get(f"{campaign_id}/insights", token, params)
    result = {}
    for row in data.get("data", []):
        sid = row.get("adset_id")
        if sid:
            result[sid] = _parse_campaign_insights(row)
    return result


def _fetch_ad_insights_breakdown(adset_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> dict:
    """Fetch per-ad insights breakdown from adset. Returns {ad_id: metrics_dict}."""
    params = _insights_params(period, date_from, date_to)
    params["level"] = "ad"
    params["fields"] = "ad_id," + _META_INSIGHT_FIELDS
    data = meta_get(f"{adset_id}/insights", token, params)
    result = {}
    for row in data.get("data", []):
        aid = row.get("ad_id")
        if aid:
            result[aid] = _parse_campaign_insights(row)
    return result


# ── Full metrics field string for Meta Graph API ─────────────────────────────
_META_INSIGHT_FIELDS = (
    "spend,impressions,reach,"
    "clicks,inline_link_clicks,outbound_clicks,"
    "ctr,cost_per_inline_link_click,"
    "actions,action_values,cost_per_action_type,"
    "video_3_sec_watched_actions,video_thruplay_watched_actions"
)

_PURCHASE_TYPES   = {"purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"}
_CHECKOUT_TYPES   = {"initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"}
_LPV_TYPES        = {"landing_page_view"}
_VIDEO3S_TYPES    = {"video_view"}  # 3-second views come from video_3_sec_watched_actions
_OUTBOUND_TYPES   = {"outbound_click"}


def _parse_campaign_insights(ins: dict) -> dict:
    """Parse a Meta API insights dict into all key metrics."""
    spend       = float(ins.get("spend", 0))
    impressions = int(ins.get("impressions", 0))
    reach       = int(ins.get("reach", 0))
    clicks      = int(ins.get("clicks", 0))
    link_clicks = int(ins.get("inline_link_clicks", 0))
    ctr         = float(ins.get("ctr", 0))
    cpc_link    = float(ins.get("cost_per_inline_link_click", 0))

    conversions  = 0
    checkouts    = 0
    lpv          = 0      # landing page views
    revenue      = 0.0
    video_3s     = 0      # 3-second video views (connect rate numerator)
    video_thru   = 0      # ThruPlay views

    # Parse actions array
    for a in ins.get("actions", []):
        t   = a.get("action_type", "")
        val = int(float(a.get("value", 0)))
        if t in _PURCHASE_TYPES:   conversions += val
        if t in _CHECKOUT_TYPES:   checkouts   += val
        if t in _LPV_TYPES:        lpv         += val

    # Parse action_values (revenue)
    for av in ins.get("action_values", []):
        if av.get("action_type", "") in _PURCHASE_TYPES:
            revenue += float(av.get("value", 0))

    # video_3_sec_watched_actions is a list like [{"action_type":"video_view","value":"123"}]
    for v in ins.get("video_3_sec_watched_actions", []):
        video_3s += int(float(v.get("value", 0)))
    for v in ins.get("video_thruplay_watched_actions", []):
        video_thru += int(float(v.get("value", 0)))

    # ── Derived metrics ───────────────────────────────────────────────────────
    roas        = round(revenue / spend, 2)          if spend > 0 else 0
    cpa         = round(spend / conversions, 2)       if conversions > 0 else 0
    cost_per_co = round(spend / checkouts, 2)         if checkouts > 0 else 0
    cost_per_lp = round(spend / lpv, 2)               if lpv > 0 else 0
    # Connect Rate: 3-sec video views / impressions (or reach for stricter def)
    connect_rate      = round(video_3s / impressions * 100, 2) if impressions > 0 else 0
    # LP View Rate: landing_page_views / link_clicks
    lp_view_rate      = round(lpv / link_clicks * 100, 2)      if link_clicks > 0 else 0
    # Checkout rate per LP view
    checkout_per_lpv  = round(checkouts / lpv * 100, 2)         if lpv > 0 else 0
    # Purchase rate per IC (initiate checkout → purchase)
    purchase_per_ic   = round(conversions / checkouts * 100, 2) if checkouts > 0 else 0

    return {
        # spend / scale
        "spend":             spend,
        "revenue":           round(revenue, 2),
        # reach & impressions
        "impressions":       impressions,
        "reach":             reach,
        # clicks
        "clicks":            clicks,
        "link_clicks":       link_clicks,
        # rates
        "ctr":               round(ctr, 2),
        "connect_rate":      connect_rate,
        "lp_view_rate":      lp_view_rate,
        "checkout_per_lpv":  checkout_per_lpv,
        "purchase_per_ic":   purchase_per_ic,
        # costs
        "cpc_link":          round(cpc_link, 2),
        "cost_per_lp":       cost_per_lp,
        "cpa":               cpa,
        "cost_per_checkout": cost_per_co,
        # funnel volumes
        "lpv":               lpv,
        "checkouts":         checkouts,
        "conversions":       conversions,
        # video
        "video_3s":          video_3s,
        "video_thru":        video_thru,
        # composite
        "roas":              roas,
    }


@app.get("/api/accounts/with-metrics")
def accounts_with_metrics(period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return all accounts with aggregated metrics from Meta API for the given period."""
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    result = []
    for acc in accounts:
        a = dict(acc)
        token = a.get("access_token", "")
        # Fetch all campaigns (for count) — no insights filter, so all campaigns returned
        camps_data = meta_get(f"{a['account_id']}/campaigns", token, {"fields": "id,status", "limit": 200})
        camps_raw = camps_data.get("data", []) if "data" in camps_data else []
        campaign_count = len(camps_raw)
        active_count = sum(1 for c in camps_raw if c.get("status") == "ACTIVE")
        # Fetch account-level aggregated insights (separate call — always returns data)
        m = _fetch_account_insights(a["account_id"], token, period, date_from, date_to)
        result.append({
            "id": a["id"],
            "name": a["name"],
            "account_id": a["account_id"],
            "bm_id": a.get("bm_id"),
            "country": a.get("country", ""),
            "status": a.get("status", "active"),
            "period": period,
            **{k: m.get(k, 0) for k in _EMPTY_METRICS},
            "campaign_count": campaign_count,
            "active_campaigns": active_count,
        })
    return result


@app.get("/api/accounts/{acc_id}/overview")
def account_overview(acc_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Full account overview: KPI totals + all campaigns with metrics."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    acc = dict(acc_row)
    token = acc.get("access_token", "")
    acct_id = acc["account_id"]
    # 1. Fetch ALL campaigns (no insights filter — returns all regardless of spend)
    camps_data = meta_get(acct_id + "/campaigns", token, {
        "fields": "id,name,status,daily_budget,lifetime_budget", "limit": 200
    })
    campaigns_raw = camps_data.get("data", []) if "data" in camps_data else []
    # 2. Fetch per-campaign insights breakdown (only campaigns with activity)
    camp_ins = _fetch_campaign_insights_breakdown(acct_id, token, period, date_from, date_to)
    # 3. Fetch account-level totals (more reliable than summing campaigns)
    total_m = _fetch_account_insights(acct_id, token, period, date_from, date_to)
    # 4. Build campaign list merging all campaigns + their insights (0 if no activity)
    campaigns = []
    for c in campaigns_raw:
        m = camp_ins.get(c["id"], dict(_EMPTY_METRICS))
        db_raw = c.get("daily_budget")
        lb_raw = c.get("lifetime_budget")
        campaigns.append({
            "id": c["id"],
            "name": c["name"],
            "status": c.get("status", "UNKNOWN").lower(),
            "daily_budget": round(float(db_raw) / 100, 2) if db_raw else None,
            "lifetime_budget": round(float(lb_raw) / 100, 2) if lb_raw else None,
            **m,
        })
    # Sort by spend desc
    campaigns.sort(key=lambda x: x["spend"], reverse=True)
    return {
        "id": acc["id"],
        "name": acc["name"],
        "account_id": acct_id,
        "bm_id": acc.get("bm_id"),
        "country": acc.get("country", ""),
        "status": acc.get("status", "active"),
        "period": period,
        "metrics": total_m,
        "campaigns": campaigns,
    }


def _fetch_demographic_insights(account_id: str, token: str, period: str, date_from: str = "", date_to: str = "") -> list:
    """Fetch age+gender demographic breakdown from Meta API. Returns list of {age, gender, ...metrics}."""
    params = _insights_params(period, date_from, date_to)
    params["breakdowns"] = "age,gender"
    data = meta_get(f"{account_id}/insights", token, params)
    result = []
    for row in data.get("data", []):
        m = _parse_campaign_insights(row)
        result.append({
            "age": row.get("age", "unknown"),
            "gender": row.get("gender", "unknown"),
            **m,
        })
    return result


def _recalc_derived(m: dict) -> None:
    """Recalculate derived metrics after summing raw values."""
    m["roas"]     = round(m["revenue"] / m["spend"], 2)       if m["spend"] > 0      else 0
    m["cpa"]      = round(m["spend"]   / m["conversions"], 2) if m["conversions"] > 0 else 0
    m["ctr"]      = round(m["clicks"]  / m["impressions"] * 100, 2) if m["impressions"] > 0 else 0
    m["cpc_link"] = round(m["spend"]   / m["link_clicks"], 2) if m["link_clicks"] > 0 else 0


@app.get("/api/accounts/{acc_id}/demographics")
def account_demographics(acc_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return demographic breakdown (age + gender) for an ad account."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    acc = dict(acc_row)
    token = acc.get("access_token", "")
    acct_id = acc["account_id"]

    rows = _fetch_demographic_insights(acct_id, token, period, date_from, date_to)

    # ── Aggregate by gender ───────────────────────────────────────────────────
    gender_map: dict = {}
    for r in rows:
        g = r["gender"]
        if g not in gender_map:
            gender_map[g] = dict(_EMPTY_METRICS)
        for k in _EMPTY_METRICS:
            gender_map[g][k] += r.get(k, 0)
    for m in gender_map.values():
        _recalc_derived(m)

    _GENDER_LABELS = {"male": "Homem", "female": "Mulher", "unknown": "Indefinido"}
    gender_rows = sorted(
        [{"gender": g, "gender_label": _GENDER_LABELS.get(g, g.title()), **m}
         for g, m in gender_map.items()],
        key=lambda x: x["spend"], reverse=True,
    )

    # ── Aggregate by age ──────────────────────────────────────────────────────
    age_map: dict = {}
    for r in rows:
        a = r["age"]
        if a not in age_map:
            age_map[a] = dict(_EMPTY_METRICS)
        for k in _EMPTY_METRICS:
            age_map[a][k] += r.get(k, 0)
    for m in age_map.values():
        _recalc_derived(m)

    _AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    age_rows = sorted(
        [{"age": a, **m} for a, m in age_map.items()],
        key=lambda x: _AGE_ORDER.index(x["age"]) if x["age"] in _AGE_ORDER else 99,
    )

    return {"by_gender": gender_rows, "by_age": age_rows}


@app.get("/api/accounts/{acc_id}/campaigns/{camp_id}/adsets")
def campaign_adsets(acc_id: str, camp_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return all ad sets for a campaign with metrics."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    token = dict(acc_row).get("access_token", "")
    # 1. Fetch ALL adsets (no insights filter)
    data = meta_get(f"{camp_id}/adsets", token, {"fields": "id,name,status,daily_budget", "limit": 200})
    adsets_raw = data.get("data", []) if "data" in data else []
    # 2. Fetch per-adset insights breakdown
    adset_ins = _fetch_adset_insights_breakdown(camp_id, token, period, date_from, date_to)
    adsets = []
    for s in adsets_raw:
        m = adset_ins.get(s["id"], dict(_EMPTY_METRICS))
        db_raw = s.get("daily_budget")
        adsets.append({
            "id": s["id"],
            "name": s["name"],
            "status": s.get("status", "UNKNOWN").lower(),
            "daily_budget": round(float(db_raw) / 100, 2) if db_raw else None,
            **m,
        })
    adsets.sort(key=lambda x: x["spend"], reverse=True)
    return adsets


@app.get("/api/accounts/{acc_id}/campaigns/{camp_id}/adsets/{adset_id}/ads")
def adset_ads(acc_id: str, camp_id: str, adset_id: str, period: str = "last_7d", date_from: str = "", date_to: str = ""):
    """Return all ads for an adset with metrics."""
    conn = get_db()
    acc_row = conn.execute("SELECT * FROM ad_accounts WHERE id=?", (acc_id,)).fetchone()
    conn.close()
    if not acc_row:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    token = dict(acc_row).get("access_token", "")
    data = meta_get(f"{adset_id}/ads", token, {"fields": "id,name,status", "limit": 200})
    ads_raw = data.get("data", []) if "data" in data else []
    ad_ins = _fetch_ad_insights_breakdown(adset_id, token, period, date_from, date_to)
    ads = []
    for a in ads_raw:
        ads.append({"id": a["id"], "name": a["name"],
                    "status": a.get("status", "UNKNOWN").lower(),
                    **ad_ins.get(a["id"], dict(_EMPTY_METRICS))})
    ads.sort(key=lambda x: x["spend"], reverse=True)
    return ads


# ─── API Connections ──────────────────────────────────────────────────────────

ALL_CAPS = ["identity", "campaigns_read", "insights_read", "campaigns_pause", "campaigns_activate", "budget_edit", "campaigns_create"]
READ_CAPS = ["identity", "campaigns_read", "insights_read"]
FULL_CAPS = ALL_CAPS[:]

def _build_caps(token: str, account_id: str, token_type: str) -> tuple:
    """Verify token and return (user_name, user_id, capabilities_list)."""
    if token.startswith("demo") or token.startswith("test"):
        caps = READ_CAPS if token_type == "readonly" else FULL_CAPS
        return "Demo User", "demo_001", caps
    me = meta_get("me", token, {"fields": "id,name"})
    if "error" in me:
        return None, None, []
    user_name = me.get("name", "")
    user_id = me.get("id", "")
    caps = ["identity"]
    if account_id:
        camps = fetch_meta_campaigns(account_id, token)
        if isinstance(camps, list):
            caps += ["campaigns_read", "insights_read"]
    else:
        caps += ["campaigns_read", "insights_read"]
    if token_type == "full":
        caps += ["campaigns_pause", "campaigns_activate", "budget_edit", "campaigns_create"]
    return user_name, user_id, caps

@app.get("/api/connections")
def list_connections():
    conn = get_db()
    rows = conn.execute("SELECT * FROM api_connections ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        tok = d.get("token", "")
        d["token_masked"] = (tok[:6] + "..." + tok[-4:]) if len(tok) > 10 else "****"
        del d["token"]
        result.append(d)
    return result

@app.post("/api/connections/verify")
def verify_connection(data: dict):
    token = data.get("token", "")
    account_id = data.get("account_id", "")
    token_type = data.get("token_type", "full")
    if not token:
        return {"valid": False, "message": "Token não fornecido."}
    user_name, user_id, caps = _build_caps(token, account_id, token_type)
    if user_name is None:
        return {"valid": False, "message": "Token inválido. Verifique o access token Meta."}
    return {
        "valid": True,
        "user_name": user_name,
        "user_id": user_id,
        "capabilities": caps,
        "message": f"Conectado como {user_name}!"
    }

@app.post("/api/connections")
def add_connection(data: dict):
    token = data.get("token", "")
    if not token or not data.get("name"):
        raise HTTPException(400, "name e token são obrigatórios")
    verified = data.get("verified_data") or {}
    user_name = verified.get("user_name", "")
    user_id = verified.get("user_id", "")
    caps = verified.get("capabilities", [])
    if not caps:
        u, uid, caps = _build_caps(token, data.get("account_id", ""), data.get("token_type", "full"))
        user_name = u or ""
        user_id = uid or ""
    cid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO api_connections (id, name, token, token_type, account_id, bm_id, user_name, user_id, capabilities) VALUES (?,?,?,?,?,?,?,?,?)",
        (cid, data["name"], token, data.get("token_type", "full"),
         data.get("account_id", ""), data.get("bm_id", ""),
         user_name, user_id, json.dumps(caps))
    )
    conn.commit()
    conn.close()
    return {"id": cid, "status": "success", "message": "Conexão adicionada com sucesso!"}

@app.delete("/api/connections/{conn_id}")
def delete_connection(conn_id: str):
    conn = get_db()
    conn.execute("DELETE FROM api_connections WHERE id=?", (conn_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/connections/capabilities")
def get_aggregate_capabilities():
    """Returns aggregate of all capabilities across all connections."""
    conn = get_db()
    rows = conn.execute("SELECT capabilities, token_type FROM api_connections WHERE status='active'").fetchall()
    conn.close()
    caps = set()
    has_full = False
    has_readonly = False
    for r in rows:
        arr = json.loads(r["capabilities"] or "[]")
        for c in arr:
            caps.add(c)
        if r["token_type"] == "full":
            has_full = True
        else:
            has_readonly = True
    return {
        "capabilities": list(caps),
        "has_full_access": has_full,
        "has_readonly": has_readonly,
        "connection_count": len(rows)
    }

# ─── Live Poll ────────────────────────────────────────────────────────────────

@app.get("/api/live")
def live_summary(period: str = "today"):
    """Lightweight live poll: returns aggregated totals for all accounts.
    Called by the frontend every N seconds to keep metrics fresh."""
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    totals = dict(_EMPTY_METRICS)
    account_data = []
    for acc in accounts:
        a = dict(acc)
        m = _fetch_account_insights(a["account_id"], a["access_token"], period)
        account_data.append({"id": a["id"], "name": a["name"], **m})
        for k in _EMPTY_METRICS:
            totals[k] = round(totals[k] + m.get(k, 0), 4)
    return {
        "updated_at": datetime.now().isoformat(),
        "period": period,
        "totals": totals,
        "accounts": account_data,
    }


# ─── Campaigns ────────────────────────────────────────────────────────────────

@app.get("/api/campaigns")
def list_campaigns(status: Optional[str] = None, period: str = "last_7d"):
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return []
    # Real accounts: fetch from Meta
    all_campaigns = []
    for acc in accounts:
        acc_d = dict(acc)
        meta_camps = fetch_meta_campaigns(acc_d["account_id"], acc_d["access_token"])
        for mc in meta_camps:
            ins = fetch_meta_insights(mc["id"], acc_d["access_token"], period)
            camp = {
                "id":           mc["id"],
                "name":         mc["name"],
                "account":      acc_d["name"],
                "account_id":   acc_d["id"],
                "country":      acc_d.get("country", ""),
                "status":       mc["status"].lower(),
                # all metrics from parser
                **{k: ins.get(k, 0) for k in _EMPTY_METRICS},
            }
            if not status or camp["status"] == status:
                all_campaigns.append(camp)
    return all_campaigns

@app.post("/api/campaigns/{cid}/pause")
def pause_campaign(cid: str):
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": "Campanha pausada! (modo demo)"}
    # Try to pause on Meta API
    for acc in accounts:
        token = dict(acc)["access_token"]
        if pause_meta_campaign(cid, token):
            return {"status": "success", "message": "Campanha pausada no Meta com sucesso!"}
    return {"status": "error", "message": "Não foi possível pausar a campanha."}

@app.post("/api/campaigns/{cid}/activate")
def activate_campaign(cid: str):
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": "Campanha ativada! (modo demo)"}
    for acc in accounts:
        token = dict(acc)["access_token"]
        if activate_meta_campaign(cid, token):
            return {"status": "success", "message": "Campanha ativada no Meta com sucesso!"}
    return {"status": "error", "message": "Não foi possível ativar a campanha."}

@app.post("/api/campaigns/bulk-pause")
def bulk_pause(data: dict):
    ids = data.get("ids", [])
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": f"{len(ids)} campanha(s) pausada(s)! (modo demo)"}
    success = 0
    for cid in ids:
        for acc in accounts:
            if pause_meta_campaign(cid, dict(acc)["access_token"]):
                success += 1
                break
    return {"status": "success", "message": f"{success}/{len(ids)} campanha(s) pausada(s) no Meta!"}

@app.post("/api/campaigns/bulk-activate")
def bulk_activate(data: dict):
    ids = data.get("ids", [])
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    if not accounts:
        return {"status": "success", "message": f"{len(ids)} campanha(s) ativada(s)! (modo demo)"}
    success = 0
    for cid in ids:
        for acc in accounts:
            if activate_meta_campaign(cid, dict(acc)["access_token"]):
                success += 1
                break
    return {"status": "success", "message": f"{success}/{len(ids)} campanha(s) ativada(s) no Meta!"}

# ─── Rules ────────────────────────────────────────────────────────────────────

@app.get("/api/rules")
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

@app.post("/api/rules")
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

@app.put("/api/rules/{rule_id}")
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

@app.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: str):
    conn = get_db()
    conn.execute("DELETE FROM rules WHERE id=?", (rule_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/rules/run-engine")
def trigger_rule_engine():
    """Manually trigger the rule engine to evaluate all active rules."""
    try:
        result = run_rules_engine()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rules/engine-log")
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

@app.post("/api/rules/parse-natural")
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

# ─── Alerts ───────────────────────────────────────────────────────────────────

@app.get("/api/alerts")
def list_alerts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM alerts WHERE status='active' ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/alerts/{alert_id}/ignore")
def ignore_alert(alert_id: str):
    conn = get_db()
    conn.execute("UPDATE alerts SET status='ignored' WHERE id=?", (alert_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── Reports ──────────────────────────────────────────────────────────────────

@app.post("/api/reports/generate")
def generate_report(data: dict):
    days = data.get("days", 7)
    campaigns = _fetch_all_campaigns_cached()
    total_invest = sum(c.get("spend", 0) for c in campaigns)
    total_conv = sum(c.get("conversions", 0) for c in campaigns)
    total_rev = sum(c.get("revenue", 0) for c in campaigns)
    avg_roas = round(total_rev / total_invest, 2) if total_invest > 0 else 0
    avg_cpa = round(total_invest / total_conv, 2) if total_conv > 0 else 0
    by_acc = {}
    for c in campaigns:
        acc = c.get("account", "")
        if acc not in by_acc:
            by_acc[acc] = {"name": acc, "spend": 0, "conversions": 0}
        by_acc[acc]["spend"] += c.get("spend", 0)
        by_acc[acc]["conversions"] += c.get("conversions", 0)
    return {
        "status": "success",
        "data": {
            "time_series": gen_time_series(days),
            "summary": {
                "total_invest": round(total_invest, 2),
                "total_conversions": total_conv,
                "avg_roas": avg_roas,
                "avg_cpa": avg_cpa,
            },
            "by_account": list(by_acc.values()),
        },
    }

# ─── Settings ─────────────────────────────────────────────────────────────────

@app.get("/api/settings")
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

@app.post("/api/settings")
def save_settings(data: dict):
    conn = get_db()
    for key, val in data.items():
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)", (key, str(val)))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── Status ───────────────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    conn = get_db()
    bm_count   = conn.execute("SELECT COUNT(*) FROM business_managers").fetchone()[0]
    acc_count  = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0]
    rule_count = conn.execute("SELECT COUNT(*) FROM rules").fetchone()[0]
    alert_count= conn.execute("SELECT COUNT(*) FROM alerts WHERE status='active'").fetchone()[0]
    anthropic_set = conn.execute("SELECT COUNT(*) FROM settings WHERE key='anthropic_api_key' AND value!=''").fetchone()[0]
    openai_set    = conn.execute("SELECT COUNT(*) FROM settings WHERE key='openai_api_key' AND value!=''").fetchone()[0]
    ai_provider   = conn.execute("SELECT value FROM settings WHERE key='ai_provider'").fetchone()
    last_log      = conn.execute("SELECT ran_at, actions_taken FROM rule_engine_log ORDER BY ran_at DESC LIMIT 1").fetchone()
    conn.close()
    provider = ai_provider["value"] if ai_provider else "anthropic"
    ai_configured = (
        (provider == "openai" and (bool(openai_set) or bool(os.environ.get("OPENAI_API_KEY")))) or
        (provider == "anthropic" and (bool(anthropic_set) or bool(os.environ.get("ANTHROPIC_API_KEY"))))
    )
    return {
        "demo_mode": False,
        "bm_count": bm_count,
        "account_count": acc_count,
        "rule_count": rule_count,
        "alert_count": alert_count,
        "ai_configured": ai_configured,
        "ai_provider": provider,
        "last_engine_run": dict(last_log) if last_log else None,
    }

# ─── AI AGENT CORE ────────────────────────────────────────────────────────────

def get_agent_config(key: str, default: str = "") -> str:
    conn = get_db()
    row = conn.execute("SELECT value FROM agent_config WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default

def set_agent_config(key: str, value: str):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO agent_config (key, value) VALUES (?,?)", (key, value))
    conn.commit()
    conn.close()

def get_db_products() -> list:
    conn = get_db()
    rows = conn.execute("SELECT * FROM ai_products ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_db_knowledge() -> list:
    conn = get_db()
    rows = conn.execute("SELECT * FROM ai_knowledge ORDER BY category, created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def build_agent_system_prompt(products: list, knowledge: list, autonomy: int = 1) -> str:
    prompt = """Você é um gestor de tráfego pago especialista em Meta Ads com anos de experiência gerenciando campanhas de alto volume e ROI. Você trabalha 24/7 analisando campanhas, protegendo orçamento e identificando oportunidades.

Seu trabalho é:
1. Analisar as métricas das campanhas ativas e identificar problemas
2. Recomendar ações concretas baseadas em dados (pausar, escalar, ajustar)
3. Gerar insights estratégicos sobre performance e tendências
4. Emitir alertas quando há anomalias ou riscos ao orçamento
5. Sugerir otimizações de criativo, público e estrutura de campanha"""

    if products:
        prompt += "\n\n## PRODUTOS E METAS:\n"
        for p in products:
            prompt += f"- **{p['name']}**: CPA meta ${p['cpa_target']:.2f}, ROAS meta {p['roas_target']:.1f}x, Ticket médio ${p['avg_ticket']:.2f}"
            if p.get('countries'):
                prompt += f", Países: {p['countries']}"
            if p.get('notes'):
                prompt += f"\n  Notas: {p['notes']}"
            prompt += "\n"

    if knowledge:
        by_cat = {}
        for k in knowledge:
            by_cat.setdefault(k['category'], []).append(k)
        prompt += "\n## CONHECIMENTO DO NEGÓCIO:\n"
        for cat, items in by_cat.items():
            cat_labels = {'market':'Mercado','preference':'Preferências','strategy':'Estratégias','audience':'Público','creative':'Criativos'}
            prompt += f"\n### {cat_labels.get(cat, cat.title())}:\n"
            for k in items:
                prompt += f"- **{k['title']}**: {k['content']}\n"

    autonomy_desc = {
        1: "Apenas analise e sugira — NÃO execute nenhuma ação automaticamente. Coloque executar=false em todas as ações.",
        2: "Pode pausar campanhas ruins automaticamente. Coloque executar=true apenas para ação 'pause'.",
        3: "Pode pausar e sugerir ajuste de orçamento. Coloque executar=true para 'pause' e 'adjust_budget'.",
        4: "Controle total: pause, ajuste orçamento, redistribua budget. Executar=true para todas as ações."
    }
    prompt += f"\n## NÍVEL DE AUTONOMIA: {autonomy}\n{autonomy_desc.get(autonomy, autonomy_desc[1])}\n"

    prompt += """
## FORMATO OBRIGATÓRIO DE RESPOSTA:
Responda APENAS com JSON válido (sem markdown, sem explicações fora do JSON):
{
  "status_geral": "bom|atencao|critico",
  "resumo": "Resumo em 2-3 frases da situação atual das campanhas",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "alertas": [
    {"campanha": "nome", "severidade": "critico|aviso|info", "mensagem": "...", "acao_recomendada": "..."}
  ],
  "acoes_automaticas": [
    {"campanha_id": "id", "campanha_nome": "nome", "acao": "pause|adjust_budget|notify", "motivo": "...", "executar": true}
  ],
  "sugestoes_usuario": [
    {"tipo": "criativo|publico|estrategia|orcamento", "titulo": "...", "descricao": "..."}
  ],
  "metricas_destaque": {
    "melhor_campanha": "nome ou null",
    "pior_campanha": "nome ou null",
    "total_gasto": 0,
    "total_conversoes": 0,
    "roas_medio": 0
  }
}"""
    return prompt

def get_campaigns_for_agent() -> tuple:
    """Return (campaigns_list, is_demo) with current metrics."""
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    is_demo = len(accounts) == 0
    if is_demo:
        return MOCK_CAMPAIGNS.copy(), True
    campaigns = []
    for acc in accounts:
        acc_d = dict(acc)
        meta_camps = fetch_meta_campaigns(acc_d["account_id"], acc_d["access_token"])
        for mc in meta_camps:
            insights = fetch_meta_insights(mc["id"], acc_d["access_token"], "last_7d")
            campaigns.append({
                "id": mc["id"], "name": mc["name"],
                "account": acc_d["name"], "account_id": acc_d["id"],
                "status": mc["status"].lower(),
                "spend": insights.get("spend", 0),
                "conversions": insights.get("conversions", 0),
                "roas": insights.get("roas", 0),
                "cpa": insights.get("cpa", 0),
                "ctr": insights.get("ctr", 0),
                "_token": acc_d["access_token"],
            })
    return campaigns, False

def run_ai_cycle_logic(api_key: str) -> dict:
    """Core AI analysis cycle: call Claude and optionally execute actions."""
    products = get_db_products()
    knowledge = get_db_knowledge()
    autonomy = int(get_agent_config("autonomy_level", "1"))
    campaigns, is_demo = get_campaigns_for_agent()

    system_prompt = build_agent_system_prompt(products, knowledge, autonomy)

    # Build campaign data for Claude
    camp_text = "## DADOS ATUAIS DAS CAMPANHAS:\n"
    for c in campaigns[:20]:
        status_label = "ATIVA" if c.get("status") == "active" else "PAUSADA"
        camp_text += (
            f"- [{status_label}] {c['name']} | "
            f"Gasto: ${c.get('spend',0):.2f} | "
            f"ROAS: {c.get('roas',0):.2f}x | "
            f"CPA: ${c.get('cpa',0):.2f} | "
            f"CTR: {c.get('ctr',0):.2f}% | "
            f"Conversões: {c.get('conversions',0)} | "
            f"ID: {c['id']}\n"
        )

    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=system_prompt,
        messages=[{"role": "user", "content": camp_text}]
    )
    raw = msg.content[0].text.strip()
    analysis = json.loads(_strip_json(raw))

    # Persist cycle
    cycle_id = str(uuid.uuid4())
    actions_taken = 0
    conn = get_db()
    conn.execute(
        "INSERT INTO ai_cycles (id, status, campaigns_analyzed, insights, alerts_json, raw_analysis) VALUES (?,?,?,?,?,?)",
        (cycle_id, "running", len(campaigns),
         json.dumps(analysis.get("insights", [])),
         json.dumps(analysis.get("alertas", [])),
         raw)
    )
    conn.commit()

    # Execute automatic actions
    camp_map = {c["id"]: c for c in campaigns}
    for action in analysis.get("acoes_automaticas", []):
        if not action.get("executar"):
            continue
        cid = action.get("campanha_id", "")
        camp = camp_map.get(cid)
        token = camp.get("_token", "") if camp else ""
        acao = action.get("acao", "")
        success = True
        if acao == "pause" and not is_demo and token:
            success = pause_meta_campaign(cid, token)
        if success:
            did = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO ai_decisions (id, cycle_id, campaign_id, campaign_name, action, reason, metrics_snapshot, executed) VALUES (?,?,?,?,?,?,?,?)",
                (did, cycle_id, cid, action.get("campanha_nome", ""), acao,
                 action.get("motivo", ""), json.dumps(camp or {}), 1)
            )
            actions_taken += 1

    # Save suggestions as decisions (not executed)
    for sug in analysis.get("sugestoes_usuario", []):
        did = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO ai_decisions (id, cycle_id, campaign_id, campaign_name, action, reason, metrics_snapshot, executed) VALUES (?,?,?,?,?,?,?,?)",
            (did, cycle_id, "", "", "suggest",
             f"[{sug.get('tipo','')}] {sug.get('titulo','')}: {sug.get('descricao','')}", "{}", 0)
        )

    conn.execute(
        "UPDATE ai_cycles SET status='completed', completed_at=?, actions_taken=? WHERE id=?",
        (datetime.now().isoformat(), actions_taken, cycle_id)
    )
    conn.commit()
    conn.close()

    set_agent_config("last_cycle_at", datetime.now().isoformat())
    set_agent_config("last_cycle_status", analysis.get("status_geral", "bom"))
    set_agent_config("last_cycle_summary", analysis.get("resumo", ""))

    return {"cycle_id": cycle_id, "analysis": analysis, "actions_taken": actions_taken, "campaigns_analyzed": len(campaigns)}

# ─── AI AGENT ENDPOINTS ────────────────────────────────────────────────────────

@app.get("/api/agent/status")
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

@app.post("/api/agent/run")
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

@app.get("/api/agent/cycles")
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

@app.get("/api/agent/decisions")
def get_decisions(limit: int = 50, executed: Optional[int] = None):
    conn = get_db()
    if executed is not None:
        rows = conn.execute("SELECT * FROM ai_decisions WHERE executed=? ORDER BY created_at DESC LIMIT ?", (executed, limit)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM ai_decisions ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/agent/config")
def get_agent_config_endpoint():
    conn = get_db()
    rows = conn.execute("SELECT * FROM agent_config").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

@app.post("/api/agent/config")
def save_agent_config(data: dict):
    conn = get_db()
    for key, val in data.items():
        conn.execute("INSERT OR REPLACE INTO agent_config (key, value) VALUES (?,?)", (key, str(val)))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── AI PRODUCTS ───────────────────────────────────────────────────────────────

@app.get("/api/ai-products")
def list_ai_products():
    return get_db_products()

@app.get("/api/ai-products/by-country")
def list_ai_products_by_country():
    """Return products grouped by country code."""
    products = get_db_products()
    groups: dict = {}
    for p in products:
        c = (p.get("country") or "").strip().lower() or "other"
        groups.setdefault(c, []).append(p)
    return [{"country": c, "products": prods} for c, prods in sorted(groups.items())]

@app.post("/api/ai-products")
def create_ai_product(data: dict):
    conn = get_db()
    pid = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO ai_products (id, name, country, shopify_code, campaign_type, cpa_target, roas_target, avg_ticket, peak_months, creative_types, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (pid, data["name"], data.get("country", ""), data.get("shopify_code", ""),
         data.get("campaign_type", ""), data.get("cpa_target", 0), data.get("roas_target", 0),
         data.get("avg_ticket", 0), data.get("peak_months", ""),
         data.get("creative_types", ""), data.get("notes", ""))
    )
    conn.commit()
    conn.close()
    return {"id": pid, "status": "success"}

@app.put("/api/ai-products/{pid}")
def update_ai_product(pid: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE ai_products SET name=?, country=?, shopify_code=?, campaign_type=?, cpa_target=?, roas_target=?, avg_ticket=?, peak_months=?, creative_types=?, notes=? WHERE id=?",
        (data.get("name"), data.get("country", ""), data.get("shopify_code", ""),
         data.get("campaign_type", ""), data.get("cpa_target", 0), data.get("roas_target", 0),
         data.get("avg_ticket", 0), data.get("peak_months", ""),
         data.get("creative_types", ""), data.get("notes", ""), pid)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/ai-products/{pid}")
def delete_ai_product(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM ai_products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── KNOWLEDGE BASE ────────────────────────────────────────────────────────────

@app.get("/api/knowledge-base")
def list_knowledge():
    return get_db_knowledge()

@app.post("/api/knowledge-base")
def create_knowledge(data: dict):
    conn = get_db()
    kid = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO ai_knowledge (id, category, title, content) VALUES (?,?,?,?)",
        (kid, data.get("category", "strategy"), data["title"], data["content"])
    )
    conn.commit()
    conn.close()
    return {"id": kid, "status": "success"}

@app.put("/api/knowledge-base/{kid}")
def update_knowledge(kid: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE ai_knowledge SET category=?, title=?, content=? WHERE id=?",
        (data.get("category"), data.get("title"), data.get("content"), kid)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/knowledge-base/{kid}")
def delete_knowledge(kid: str):
    conn = get_db()
    conn.execute("DELETE FROM ai_knowledge WHERE id=?", (kid,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── CHAT ──────────────────────────────────────────────────────────────────────

@app.get("/api/chat/messages")
def get_chat_messages(limit: int = 40):
    conn = get_db()
    rows = conn.execute("SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/chat/send")
def send_chat_message(data: dict):
    user_msg = data.get("message", "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Mensagem vazia.")
    api_key = get_setting("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="Chave Anthropic não configurada.")

    products = get_db_products()
    knowledge = get_db_knowledge()
    campaigns, is_demo = get_campaigns_for_agent()

    system = build_agent_system_prompt(products, knowledge, 1)
    system += "\n\n## DADOS ATUAIS DAS CAMPANHAS:\n"
    for c in campaigns[:15]:
        system += (
            f"- [{c.get('status','?').upper()}] {c['name']}: "
            f"gasto=${c.get('spend',0):.2f}, ROAS={c.get('roas',0):.2f}x, "
            f"CPA=${c.get('cpa',0):.2f}, CTR={c.get('ctr',0):.2f}%, "
            f"conversoes={c.get('conversions',0)}\n"
        )
    system += "\nVoce é o gestor de tráfego IA desta plataforma. Responda em português de forma clara, objetiva e com dados reais. Quando relevante, cite números específicos das campanhas."

    # Fetch conversation history
    conn = get_db()
    history = conn.execute("SELECT role, content FROM chat_messages ORDER BY created_at DESC LIMIT 20").fetchall()
    history = list(reversed([dict(h) for h in history]))

    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": user_msg})

    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=messages
        )
        assistant_reply = resp.content[0].text
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Chave Anthropic inválida.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Save both messages
    uid = str(uuid.uuid4())
    aid = str(uuid.uuid4())
    conn.execute("INSERT INTO chat_messages (id, role, content) VALUES (?,?,?)", (uid, "user", user_msg))
    conn.execute("INSERT INTO chat_messages (id, role, content) VALUES (?,?,?)", (aid, "assistant", assistant_reply))
    conn.commit()
    conn.close()

    return {"status": "success", "reply": assistant_reply, "message_id": aid}

@app.delete("/api/chat/clear")
def clear_chat():
    conn = get_db()
    conn.execute("DELETE FROM chat_messages")
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── IDEAS ─────────────────────────────────────────────────────────────────────

@app.get("/api/ideas")
def list_ideas(product: Optional[str] = None, status: Optional[str] = None):
    conn = get_db()
    q = "SELECT * FROM ai_ideas WHERE 1=1"
    params = []
    if product:
        q += " AND product_name=?"; params.append(product)
    if status:
        q += " AND status=?"; params.append(status)
    q += " ORDER BY created_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/ideas/generate")
def generate_ideas(data: dict):
    api_key = get_setting("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="Chave Anthropic não configurada.")
    products = get_db_products()
    knowledge = get_db_knowledge()
    campaigns, _ = get_campaigns_for_agent()
    product_filter = data.get("product", "")

    # Build context for ideas
    context = "Você é um especialista em performance marketing e Meta Ads. Gere ideias criativas e estratégicas para melhorar os resultados.\n\n"
    if products:
        context += "Produtos:\n"
        for p in products:
            if not product_filter or p["name"] == product_filter:
                context += f"- {p['name']}: CPA meta ${p['cpa_target']}, ROAS meta {p['roas_target']}x\n"
                if p.get("notes"): context += f"  Notas: {p['notes']}\n"
    if knowledge:
        context += "\nConhecimento do negócio:\n"
        for k in knowledge[:5]:
            context += f"- {k['title']}: {k['content']}\n"
    context += "\nCampanhas atuais:\n"
    for c in campaigns[:5]:
        context += f"- {c['name']}: ROAS {c.get('roas',0):.1f}x, CPA ${c.get('cpa',0):.2f}\n"

    prompt = context + f"""
Gere 6 ideias práticas e específicas para melhorar os resultados. Inclua:
- 2 ideias de criativos (UGC, VSL, carrossel, etc.)
- 2 estratégias de audiência/segmentação
- 2 estratégias de orçamento/estrutura

Responda APENAS em JSON:
[
  {{
    "product_name": "nome do produto ou 'Geral'",
    "category": "creative|strategy|audience|budget|trend",
    "title": "Título curto da ideia",
    "description": "Descrição detalhada e prática de como implementar",
    "why_it_works": "Por que essa ideia tende a funcionar no Meta Ads",
    "impact": "low|medium|high"
  }}
]"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )
        ideas_raw = json.loads(_strip_json(msg.content[0].text))
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Erro ao processar resposta da IA.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    conn = get_db()
    saved = []
    for idea in ideas_raw:
        iid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO ai_ideas (id, product_name, category, title, description, why_it_works, impact, status) VALUES (?,?,?,?,?,?,?,?)",
            (iid, idea.get("product_name", "Geral"), idea.get("category", "strategy"),
             idea.get("title", ""), idea.get("description", ""),
             idea.get("why_it_works", ""), idea.get("impact", "medium"), "new")
        )
        saved.append({"id": iid, **idea, "status": "new"})
    conn.commit()
    conn.close()
    return {"status": "success", "ideas": saved, "count": len(saved)}

@app.put("/api/ideas/{iid}/status")
def update_idea_status(iid: str, data: dict):
    conn = get_db()
    conn.execute("UPDATE ai_ideas SET status=? WHERE id=?", (data.get("status", "new"), iid))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/ideas/{iid}")
def delete_idea(iid: str):
    conn = get_db()
    conn.execute("DELETE FROM ai_ideas WHERE id=?", (iid,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── DEEP ANALYSIS ─────────────────────────────────────────────────────────────

@app.get("/api/analysis/overview")
def get_analysis_overview(days: int = 30):
    """Return aggregated analysis data: time series, by-product, by-campaign."""
    conn = get_db()
    is_demo = conn.execute("SELECT COUNT(*) FROM ad_accounts").fetchone()[0] == 0
    conn.close()
    ts = gen_time_series(days)
    return {
        "time_series": ts,
        "by_product": [
            {"name": "PROD001", "invest": 1580.20, "conversions": 57, "roas": 3.2, "cpa": 27.72, "ctr": 2.1, "cpm": 12.4},
            {"name": "PROD002", "invest": 1124.90, "conversions": 42, "roas": 3.0, "cpa": 26.78, "ctr": 1.8, "cpm": 14.2},
            {"name": "PROD003", "invest": 643.00,  "conversions": 19, "roas": 3.7, "cpa": 33.84, "ctr": 2.8, "cpm": 10.9},
        ],
        "campaigns": MOCK_CAMPAIGNS if is_demo else [],
        "summary": {
            "total_invest": sum(d["invest"] for d in ts),
            "total_conv": sum(d["conversions"] for d in ts),
            "avg_roas": round(sum(d["roas"] for d in ts) / len(ts), 2),
        }
    }

# ─── SHEETS CONFIG ENDPOINTS ───────────────────────────────────────────────────

@app.get("/api/sheets/config")
def get_sheets_config():
    conn = get_db()
    row = conn.execute("SELECT * FROM sheets_config LIMIT 1").fetchone()
    conn.close()
    if not row:
        return {"configured": False}
    d = dict(row)
    d["service_account_json"] = "set" if d.get("service_account_json") else ""
    return {"configured": True, **d}

@app.post("/api/sheets/config")
def save_sheets_config(data: dict):
    spreadsheet_id = data.get("spreadsheet_id", "").strip()
    service_account_json = data.get("service_account_json", "").strip()
    config_tab = data.get("config_tab", "Configurações")
    ads_tab = data.get("ads_tab", "Anúncios")
    if not spreadsheet_id or not service_account_json:
        raise HTTPException(400, "spreadsheet_id e service_account_json são obrigatórios")
    try:
        json.loads(service_account_json)
    except Exception:
        raise HTTPException(400, "service_account_json inválido — deve ser o JSON completo da conta de serviço")
    conn = get_db()
    existing = conn.execute("SELECT id FROM sheets_config LIMIT 1").fetchone()
    if existing:
        conn.execute("UPDATE sheets_config SET spreadsheet_id=?, service_account_json=?, config_tab=?, ads_tab=? WHERE id=?",
                     (spreadsheet_id, service_account_json, config_tab, ads_tab, existing["id"]))
    else:
        conn.execute("INSERT INTO sheets_config (id, spreadsheet_id, service_account_json, config_tab, ads_tab) VALUES (?, ?, ?, ?, ?)",
                     (str(uuid.uuid4()), spreadsheet_id, service_account_json, config_tab, ads_tab))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/sheets/sync")
def run_sheets_sync():
    conn = get_db()
    row = conn.execute("SELECT * FROM sheets_config LIMIT 1").fetchone()
    conn.close()
    if not row:
        raise HTTPException(400, "Configuração do Google Sheets não encontrada. Configure primeiro.")
    config = dict(row)
    try:
        result = sync_sheets_to_db(config)
        conn2 = get_db()
        conn2.execute("UPDATE sheets_config SET last_synced_at=?, sync_status='ok', rows_synced=? WHERE id=?",
                      (datetime.now().isoformat(), result["synced_products"], config["id"]))
        conn2.commit()
        conn2.close()
        return {"status": "success", **result}
    except Exception as ex:
        conn2 = get_db()
        conn2.execute("UPDATE sheets_config SET sync_status='error' WHERE id=?", (config["id"],))
        conn2.commit()
        conn2.close()
        raise HTTPException(500, str(ex))

# ─── IMPORTED PRODUCTS ENDPOINTS ───────────────────────────────────────────────

@app.get("/api/imported-products")
def list_imported_products(launch_status: Optional[str] = None):
    conn = get_db()
    q = "SELECT * FROM imported_products"
    params = []
    if launch_status:
        q += " WHERE launch_status=?"
        params.append(launch_status)
    q += " ORDER BY created_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["urls_videos"] = json.loads(d.get("urls_videos", "[]"))
        d["paises"] = json.loads(d.get("paises", "[]"))
        d["video_count"] = len(d["urls_videos"])
        result.append(d)
    return result

@app.get("/api/imported-products/{pid}")
def get_imported_product(pid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM imported_products WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Produto não encontrado")
    d = dict(row)
    d["urls_videos"] = json.loads(d.get("urls_videos", "[]"))
    d["paises"] = json.loads(d.get("paises", "[]"))
    return d

@app.delete("/api/imported-products/{pid}")
def delete_imported_product(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM imported_products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/sheets-accounts")
def list_sheets_accounts():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sheets_accounts ORDER BY config_id").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["access_token"] = "***"
        d["app_secret"] = "***"
        result.append(d)
    return result

# ─── CAMPAIGN LAUNCHER ENDPOINTS ───────────────────────────────────────────────

@app.post("/api/launcher/launch")
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

@app.get("/api/launcher/job/{job_id}")
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

@app.get("/api/launcher/jobs")
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

@app.delete("/api/launcher/job/{job_id}")
def delete_launch_job(job_id: str):
    conn = get_db()
    conn.execute("DELETE FROM launch_jobs WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ─── Serve Frontend ───────────────────────────────────────────────────────────

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
@app.get("/{full_path:path}")
def serve_frontend(full_path: str = ""):
    index = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index):
        return FileResponse(index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"error": "Frontend not found"}

@app.on_event("startup")
def startup():
    init_db()
    print("\n" + "="*50)
    print("  Meta Ads Control Center v2")
    print("  http://localhost:8000")
    print("="*50 + "\n")

# ═══════════════════════════════════════════════════════════════════════════════
# WORK SESSIONS — ClickUp / Notion sync
# ═══════════════════════════════════════════════════════════════════════════════

def _take_campaign_snapshot() -> dict:
    """Snapshot all campaigns with current status and budget."""
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    snapshot = {}
    for acc in accounts:
        acc_d = dict(acc)
        try:
            camps = fetch_meta_campaigns(acc_d["account_id"], acc_d["access_token"])
            snapshot[acc_d["id"]] = {
                "name": acc_d["name"],
                "country": acc_d.get("country", ""),
                "account_id": acc_d["account_id"],
                "campaigns": {
                    c["id"]: {
                        "id": c["id"],
                        "name": c["name"],
                        "status": c.get("status", "").lower(),
                        "daily_budget": round(float(c.get("daily_budget", 0)) / 100, 2),
                    }
                    for c in camps
                }
            }
        except Exception:
            snapshot[acc_d["id"]] = {
                "name": acc_d["name"], "country": acc_d.get("country", ""),
                "account_id": acc_d["account_id"], "campaigns": {}
            }
    return snapshot


def _compute_session_diff(before: dict, after: dict) -> dict:
    """Compute changes between two snapshots. Returns diff per account."""
    result = {}
    all_ids = set(list(before.keys()) + list(after.keys()))
    for acc_id in all_ids:
        b_acc = before.get(acc_id, {})
        a_acc = after.get(acc_id, b_acc)
        b_camps = b_acc.get("campaigns", {})
        a_camps = a_acc.get("campaigns", {})
        changes = []
        for cid in set(list(b_camps.keys()) + list(a_camps.keys())):
            b, a = b_camps.get(cid), a_camps.get(cid)
            if not b and a:
                changes.append({"campaign": a["name"], "type": "new", "icon": "🆕", "detail": f"Criada — {a['status']}"})
            elif b and not a:
                changes.append({"campaign": b["name"], "type": "removed", "icon": "🗑️", "detail": "Removida"})
            else:
                name = a["name"]
                if b["status"] != a["status"]:
                    icon = "⏸️" if a["status"] == "paused" else "▶️"
                    changes.append({"campaign": name, "type": "status", "icon": icon, "detail": f"{b['status']} → {a['status']}"})
                if abs((b.get("daily_budget") or 0) - (a.get("daily_budget") or 0)) > 0.01:
                    changes.append({"campaign": name, "type": "budget", "icon": "💰",
                                    "detail": f"${b.get('daily_budget', 0):.2f} → ${a.get('daily_budget', 0):.2f}/dia"})
        result[acc_id] = {
            "name": a_acc.get("name") or b_acc.get("name", ""),
            "country": a_acc.get("country") or b_acc.get("country", ""),
            "account_id": a_acc.get("account_id") or b_acc.get("account_id", ""),
            "changes": changes,
            "total_campaigns": len(a_acc.get("campaigns", {})),
        }
    return result


@app.post("/api/sessions/start")
def session_start():
    import uuid as _uuid
    conn = get_db()
    conn.execute("UPDATE work_sessions SET status='abandoned' WHERE status='active'")
    conn.commit()
    conn.close()
    snapshot = _take_campaign_snapshot()
    sid = str(_uuid.uuid4())
    now = datetime.now().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO work_sessions (id, started_at, snapshot_before, status) VALUES (?,?,?,?)",
        (sid, now, json.dumps(snapshot), "active")
    )
    conn.commit()
    conn.close()
    return {
        "id": sid, "started_at": now,
        "accounts": len(snapshot),
        "campaigns": sum(len(a.get("campaigns", {})) for a in snapshot.values())
    }


@app.get("/api/sessions/active")
def session_get_active():
    conn = get_db()
    row = conn.execute(
        "SELECT id, started_at FROM work_sessions WHERE status='active' ORDER BY started_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if not row:
        return {"active": False}
    d = dict(row)
    return {"active": True, "id": d["id"], "started_at": d["started_at"]}


@app.post("/api/sessions/{sid}/finish")
def session_finish(sid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM work_sessions WHERE id=?", (sid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    before = json.loads(dict(row)["snapshot_before"] or "{}")
    after = _take_campaign_snapshot()
    diff = _compute_session_diff(before, after)
    now = datetime.now().isoformat()
    conn.execute(
        "UPDATE work_sessions SET snapshot_after=?, diff=?, status='finished', finished_at=? WHERE id=?",
        (json.dumps(after), json.dumps(diff), now, sid)
    )
    conn.commit()
    conn.close()
    # Also fetch current metrics for all accounts
    metrics = {}
    conn = get_db()
    accounts = _get_active_accounts(conn)
    conn.close()
    for acc in accounts:
        acc_d = dict(acc)
        try:
            m = _fetch_account_insights(acc_d["account_id"], acc_d["access_token"], "today")
            metrics[acc_d["id"]] = {"name": acc_d["name"], "country": acc_d.get("country", ""), "metrics": m}
        except Exception:
            pass
    return {"id": sid, "finished_at": now, "diff": diff, "metrics": metrics}


@app.get("/api/sessions/notion-products")
def notion_get_products():
    conn = get_db()
    rows = conn.execute(
        "SELECT key, value FROM settings WHERE key IN ('notion_token','notion_products_db_id')"
    ).fetchall()
    conn.close()
    s = {r["key"]: r["value"] for r in rows}
    token, db_id = s.get("notion_token", ""), s.get("notion_products_db_id", "")
    if not token or not db_id:
        return []
    try:
        r = requests.post(
            f"https://api.notion.com/v1/databases/{db_id}/query",
            headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28",
                     "Content-Type": "application/json"},
            json={"sorts": [{"property": "Produto", "direction": "ascending"}]},
            timeout=15
        )
        products = []
        for p in r.json().get("results", []):
            props = p.get("properties", {})
            title_arr = props.get("Produto", {}).get("title", [])
            name = title_arr[0]["text"]["content"] if title_arr else ""
            status = (props.get("Status", {}).get("select") or {}).get("name", "")
            products.append({"id": p["id"], "name": name, "status": status})
        return products
    except Exception as e:
        return {"error": str(e)}


# publish endpoint matching SyncPage frontend format
@app.post("/api/sessions/{sid}/publish")
def session_publish_v2(sid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT * FROM work_sessions WHERE id=?", (sid,)).fetchone()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    s = {r["key"]: r["value"] for r in settings_rows}
    to_clickup   = data.get("to_clickup", False)
    to_notion    = data.get("to_notion", False)
    products_data= data.get("products_data", {})   # {product_id: {name, spend, vendas, period, acao, obs}}
    diff_summary = data.get("diff_summary", "")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    results = []

    # ── ClickUp ──────────────────────────────────────────────────────────────
    if to_clickup:
        ck_key  = s.get("clickup_api_key", "")
        ck_list = s.get("clickup_list_id", "901322010985")
        if ck_key:
            lines = [f"Meta Ads Update — {now_str}", "", diff_summary, ""]
            for pid, pd in products_data.items():
                lines.append(f"• {pd.get('name','')}: ${float(pd.get('spend',0) or 0):.2f} gasto | {pd.get('vendas',0)} vendas")
                if pd.get("acao"): lines.append(f"  Ação: {pd['acao']}")
                if pd.get("obs"):  lines.append(f"  Obs: {pd['obs']}")
            title = f"Meta Ads — {datetime.now().strftime('%d/%m/%Y')}"
            try:
                r = http_req.post(
                    f"https://api.clickup.com/api/v2/list/{ck_list}/task",
                    headers={"Authorization": ck_key, "Content-Type": "application/json"},
                    json={"name": title, "description": "\n".join(lines)},
                    timeout=15
                )
                rj = r.json()
                results.append({"target":"ClickUp","label":title,"ok": r.status_code < 300,"url": rj.get("url",""),"error": rj.get("err","")})
            except Exception as e:
                results.append({"target":"ClickUp","ok":False,"error":str(e)})
        else:
            results.append({"target":"ClickUp","ok":False,"error":"API key não configurada"})

    # ── Notion ────────────────────────────────────────────────────────────────
    if to_notion:
        notion_token = s.get("notion_token", "")
        notion_db    = s.get("notion_db_id", "")
        today = datetime.now().strftime("%Y-%m-%d")
        if notion_token and notion_db:
            for pid, pd in products_data.items():
                period_val = pd.get("period", "Tarde")
                props = {
                    "Título": {"title": [{"text": {"content": f"{pd.get('name','')} — {today}"}}]},
                    "Data":   {"date": {"start": today}},
                    "Período":{"select": {"name": period_val}},
                    "Gasto (ad spend)": {"number": float(pd.get("spend", 0) or 0)},
                    "Vendas": {"number": int(float(pd.get("vendas", 0) or 0))},
                    "Ação tomada": {"rich_text": [{"text": {"content": pd.get("acao","")}}]},
                    "Observação": {"rich_text": [{"text": {"content": pd.get("obs","")}}]},
                }
                try:
                    r = http_req.post(
                        "https://api.notion.com/v1/pages",
                        headers={"Authorization": f"Bearer {notion_token}",
                                 "Notion-Version": "2022-06-28",
                                 "Content-Type": "application/json"},
                        json={"parent": {"database_id": notion_db}, "properties": props},
                        timeout=15
                    )
                    rj = r.json()
                    results.append({"target":"Notion","label":pd.get("name",""),"ok": r.status_code < 300,"url": rj.get("url","")})
                except Exception as e:
                    results.append({"target":"Notion","label":pd.get("name",""),"ok":False,"error":str(e)})
        else:
            results.append({"target":"Notion","ok":False,"error":"Notion não configurado"})

    conn2 = get_db()
    conn2.execute("UPDATE work_sessions SET status='synced' WHERE id=?", (sid,))
    conn2.commit()
    conn2.close()
    return {"ok": True, "results": results}


# ─── Auth ──────────────────────────────────────────────────────────────────────

def _hash_pw(pw: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 100_000)
    return f"{salt}:{h.hex()}"

def _verify_pw(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        check = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 100_000)
        return check.hex() == h
    except Exception:
        return False

def _create_stateless_token(uid: str, email: str, name: str) -> str:
    """Create an HMAC-signed stateless session token (survives server restarts)."""
    if not SESSION_SECRET:
        return ""
    exp = (datetime.now() + timedelta(days=30)).timestamp()
    payload = json.dumps({"uid": uid, "email": email, "name": name, "exp": exp}, separators=(',', ':'))
    b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(SESSION_SECRET.encode(), b64.encode(), hashlib.sha256).hexdigest()
    return f"sl.{b64}.{sig}"

def _verify_stateless_token(token: str) -> Optional[dict]:
    """Verify and decode a stateless token. Returns user dict or None."""
    if not SESSION_SECRET or not token.startswith("sl."):
        return None
    try:
        parts = token.split(".", 2)
        if len(parts) != 3:
            return None
        _, b64, sig = parts
        expected = hmac.new(SESSION_SECRET.encode(), b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(b64 + "==").decode())
        if payload.get("exp", 0) < datetime.now().timestamp():
            return None
        return {"user_id": payload["uid"], "email": payload["email"], "name": payload["name"]}
    except Exception:
        return None

def _get_current_user(request: Request) -> Optional[dict]:
    token = request.headers.get("X-Auth-Token") or request.cookies.get("auth_token")
    if not token:
        return None
    # Try stateless HMAC token first (works after server restart on Render)
    user = _verify_stateless_token(token)
    if user:
        return user
    # Fall back to DB-stored session
    conn = get_db()
    row = conn.execute(
        "SELECT us.user_id, u.email, u.name FROM user_sessions us "
        "JOIN users u ON u.id = us.user_id "
        "WHERE us.token=? AND us.expires_at > ?",
        (token, datetime.now().isoformat())
    ).fetchone()
    conn.close()
    return dict(row) if row else None

@app.get("/api/auth/status")
def auth_status():
    """Returns whether any user exists (setup needed or not)."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return {"has_users": count > 0}

@app.post("/api/auth/setup")
def auth_setup(data: dict):
    """Create the first user (only allowed if no users exist)."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count > 0:
        conn.close()
        raise HTTPException(status_code=403, detail="Usuário já existe. Faça login.")
    email = data.get("email", "").strip().lower()
    pw    = data.get("password", "")
    name  = data.get("name", "").strip()
    if not email or not pw:
        conn.close()
        raise HTTPException(status_code=400, detail="Email e senha obrigatórios")
    uid = str(uuid.uuid4())
    conn.execute("INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)",
                 (uid, email, name, _hash_pw(pw)))
    conn.commit()
    if SESSION_SECRET:
        token = _create_stateless_token(uid, email, name)
    else:
        token = secrets.token_hex(32)
        exp   = (datetime.now() + timedelta(days=30)).isoformat()
        conn.execute("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,?)",
                     (token, uid, exp))
        conn.commit()
    conn.close()
    return {"ok": True, "token": token, "user": {"id": uid, "email": email, "name": name}}


@app.post("/api/auth/login")
def auth_login(data: dict):
    email = data.get("email", "").strip().lower()
    pw    = data.get("password", "")
    conn  = get_db()
    user  = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not _verify_pw(pw, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if SESSION_SECRET:
        token = _create_stateless_token(user["id"], user["email"], user["name"])
        conn.close()
    else:
        token = secrets.token_hex(32)
        exp   = (datetime.now() + timedelta(days=30)).isoformat()
        conn.execute("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,?)",
                     (token, user["id"], exp))
        conn.commit()
        conn.close()
    return {"ok": True, "token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@app.post("/api/auth/logout")
def auth_logout(data: dict):
    token = data.get("token", "")
    if token:
        conn = get_db()
        conn.execute("DELETE FROM user_sessions WHERE token=?", (token,))
        conn.commit()
        conn.close()
    return {"ok": True}

@app.get("/api/auth/me")
def auth_me(request: Request):
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user

@app.put("/api/auth/me")
def auth_update_me(request: Request, data: dict):
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user["user_id"],)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    new_name  = data.get("name", row["name"])
    new_email = data.get("email", row["email"]).strip().lower()
    updates = [(new_name, new_email, row["id"])]
    conn.execute("UPDATE users SET name=?, email=? WHERE id=?", updates[0])
    if data.get("new_password"):
        if not data.get("current_password"):
            conn.close()
            raise HTTPException(status_code=400, detail="Senha atual obrigatória")
        if not _verify_pw(data["current_password"], row["password_hash"]):
            conn.close()
            raise HTTPException(status_code=400, detail="Senha atual incorreta")
        conn.execute("UPDATE users SET password_hash=? WHERE id=?",
                     (_hash_pw(data["new_password"]), row["id"]))
    conn.commit()
    conn.close()
    return {"ok": True, "user": {"id": row["id"], "email": new_email, "name": new_name}}


# ─── Projects ──────────────────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at").fetchall()
    active = get_setting("active_project_id", "")
    conn.close()
    projects = [dict(r) for r in rows]
    for p in projects:
        p["is_active"] = (p["id"] == active)
    return projects

@app.post("/api/projects")
def create_project(data: dict):
    name  = data.get("name", "").strip()
    color = data.get("color", "#3b82f6")
    if not name:
        raise HTTPException(status_code=400, detail="Nome obrigatório")
    pid = str(uuid.uuid4())
    conn = get_db()
    conn.execute("INSERT INTO projects (id, name, color) VALUES (?,?,?)", (pid, name, color))
    # Auto-activate newly created project
    conn.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('active_project_id',?)", (pid,))
    conn.commit()
    conn.close()
    return {"id": pid, "name": name, "color": color, "is_active": True}

@app.put("/api/projects/{pid}")
def update_project(pid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    name  = data.get("name", row["name"])
    color = data.get("color", row["color"])
    conn.execute("UPDATE projects SET name=?, color=? WHERE id=?", (name, color, pid))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/projects/{pid}")
def delete_project(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/projects/{pid}/activate")
def activate_project(pid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    conn.execute("INSERT OR REPLACE INTO settings (key,value) VALUES ('active_project_id',?)", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True, "active_project_id": pid}

@app.get("/api/projects/active")
def get_active_project():
    active_id = get_setting("active_project_id", "")
    if not active_id:
        return {"id": "", "name": "Todos os projetos", "color": "#64748b"}
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (active_id,)).fetchone()
    conn.close()
    return dict(row) if row else {"id": "", "name": "Todos os projetos", "color": "#64748b"}

@app.get("/api/projects/{pid}/integrations")
def get_project_integrations(pid: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    r = dict(row)
    return {
        "notion_token":          r.get("notion_token", "") or "",
        "notion_analyses_db_id": r.get("notion_analyses_db_id", "") or "",
        "notion_products_db_id": r.get("notion_products_db_id", "") or "",
        "clickup_token":         r.get("clickup_token", "") or "",
        "clickup_list_id":       r.get("clickup_list_id", "") or "",
    }

@app.put("/api/projects/{pid}/integrations")
def update_project_integrations(pid: str, data: dict):
    conn = get_db()
    row = conn.execute("SELECT id FROM projects WHERE id=?", (pid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    conn.execute(
        "UPDATE projects SET notion_token=?, notion_analyses_db_id=?, notion_products_db_id=?, clickup_token=?, clickup_list_id=? WHERE id=?",
        (
            data.get("notion_token", ""),
            data.get("notion_analyses_db_id", ""),
            data.get("notion_products_db_id", ""),
            data.get("clickup_token", ""),
            data.get("clickup_list_id", ""),
            pid,
        )
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/projects/{pid}/sync-notion")
def sync_project_notion(pid: str, data: dict):
    """Push a daily analysis row to this project's Notion Análises Diárias database."""
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    r = dict(row)
    token = r.get("notion_token", "") or ""
    db_id = r.get("notion_analyses_db_id", "") or ""
    if not token or not db_id:
        raise HTTPException(status_code=400, detail="Integração Notion não configurada para este projeto")

    props = {}
    if data.get("title"):
        props["Título"] = {"title": [{"text": {"content": str(data["title"])}}]}
    if data.get("date"):
        props["Data"] = {"date": {"start": str(data["date"])}}
    if data.get("periodo"):
        props["Período"] = {"select": {"name": str(data["periodo"])}}
    if data.get("gasto") is not None:
        props["Gasto"] = {"number": float(data["gasto"])}
    if data.get("vendas") is not None:
        props["Vendas"] = {"number": int(data["vendas"])}
    if data.get("cpa_real") is not None:
        props["CPA Real"] = {"number": float(data["cpa_real"])}
    if data.get("ctr") is not None:
        props["CTR%"] = {"number": float(data["ctr"])}
    if data.get("cliques") is not None:
        props["Cliques"] = {"number": int(data["cliques"])}
    if data.get("impressoes") is not None:
        props["Impressões"] = {"number": int(data["impressoes"])}
    if data.get("observacao"):
        props["Observação"] = {"rich_text": [{"text": {"content": str(data["observacao"])}}]}
    if data.get("acao_tomada"):
        props["Ação Tomada"] = {"rich_text": [{"text": {"content": str(data["acao_tomada"])}}]}

    try:
        resp = http_req.post(
            "https://api.notion.com/v1/pages",
            headers={
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            json={"parent": {"database_id": db_id}, "properties": props},
            timeout=15,
        )
        result = resp.json()
        if "id" in result:
            return {"ok": True, "notion_page_id": result["id"]}
        return {"ok": False, "error": result.get("message", "Erro ao criar página no Notion")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Web Intelligence ─────────────────────────────────────────────────────────

def _extract_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        d = p.netloc.replace("www.", "")
        return d
    except Exception:
        return url

def _source_icon(domain: str) -> str:
    d = domain.lower()
    if "reddit.com" in d:  return "reddit"
    if "youtube.com" in d: return "youtube"
    if "twitter.com" in d or "x.com" in d: return "twitter"
    if "instagram.com" in d: return "instagram"
    if "tiktok.com" in d:  return "tiktok"
    if "linkedin.com" in d: return "linkedin"
    return "blog"

def _serper_search(query: str, api_key: str, num: int = 8, search_type: str = "search") -> list:
    """Search via Serper API (Google). Returns list of result dicts."""
    url = f"https://google.serper.dev/{search_type}"
    try:
        r = http_req.post(
            url,
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query, "num": num, "gl": "br"},
            timeout=12
        )
        if not r.ok:
            return []
        data = r.json()
        results = []
        for item in data.get("organic", []) + data.get("news", []):
            link = item.get("link", "")
            results.append({
                "title":   item.get("title", ""),
                "link":    link,
                "snippet": item.get("snippet", ""),
                "date":    item.get("date", ""),
                "domain":  _extract_domain(link),
                "type":    _source_icon(_extract_domain(link)),
            })
        return results[:num]
    except Exception:
        return []

def _brave_search(query: str, api_key: str, num: int = 8) -> list:
    """Search via Brave Search API. Returns list of result dicts."""
    try:
        r = http_req.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"Accept": "application/json", "X-Subscription-Token": api_key},
            params={"q": query, "count": num, "safesearch": "moderate"},
            timeout=12
        )
        if not r.ok:
            return []
        data = r.json()
        results = []
        for item in data.get("web", {}).get("results", []):
            link = item.get("url", "")
            results.append({
                "title":   item.get("title", ""),
                "link":    link,
                "snippet": item.get("description", ""),
                "date":    item.get("age", ""),
                "domain":  _extract_domain(link),
                "type":    _source_icon(_extract_domain(link)),
            })
        return results[:num]
    except Exception:
        return []

def _run_intel_searches(query: str, sources: list, s: dict) -> list:
    """Execute web searches for the given query and sources. Returns combined results."""
    serper_key = s.get("serper_api_key", "")
    brave_key  = s.get("brave_api_key", "")

    if not serper_key and not brave_key:
        return []

    def search(q, typ="search"):
        if serper_key:
            return _serper_search(q, serper_key, num=6, search_type=typ)
        return _brave_search(q, brave_key, num=6)

    all_results = []
    seen_links = set()

    def add(results):
        for r in results:
            if r["link"] not in seen_links:
                seen_links.add(r["link"])
                all_results.append(r)

    source_list = sources if sources and "all" not in sources else ["reddit","youtube","x","blogs","news"]

    if "all" in sources or "reddit" in source_list:
        add(search(f"{query} site:reddit.com"))

    if "all" in sources or "youtube" in source_list:
        add(search(f"{query} site:youtube.com"))

    if "all" in sources or "x" in source_list:
        add(search(f"{query} site:twitter.com OR site:x.com"))

    if "all" in sources or "news" in source_list:
        add(search(query, "news"))

    if "all" in sources or "blogs" in source_list:
        add(search(f"{query} blog estratégia marketing digital"))
        add(search(query))

    return all_results[:30]

def _build_intel_synthesis(query: str, results: list, api_key: str, language: str = "pt-BR") -> str:
    """Ask Claude to synthesize the search results into actionable intelligence."""
    if not api_key or not results:
        return ""

    sources_text = "\n\n".join([
        f"[{i+1}] {r['title']} ({r['domain']}, {r.get('date','')})\n{r['snippet']}\nURL: {r['link']}"
        for i, r in enumerate(results[:20])
    ])

    system = (
        "Você é um analista especialista em marketing digital, tráfego pago e Meta Ads. "
        "Seu trabalho é sintetizar informações de diversas fontes da internet e entregar insights "
        "altamente relevantes e práticos para um gestor de tráfego brasileiro. "
        "Escreva em português brasileiro. Seja direto, específico e acionável. "
        "Use markdown: **negrito** para pontos-chave, listas com • para estratégias, "
        "e seções com ## para organizar. Cite as fontes com [1], [2] etc."
    )

    user_prompt = (
        f"Pergunta do gestor: **{query}**\n\n"
        f"Fontes encontradas na internet:\n\n{sources_text}\n\n"
        "Sintetize essas informações e entregue:\n"
        "1. Um resumo executivo (3-4 frases)\n"
        "2. Estratégias e insights mais relevantes encontrados\n"
        "3. O que está funcionando segundo essas fontes\n"
        "4. Pontos de atenção ou tendências\n"
        "5. Recomendações práticas para um gestor de Meta Ads no Brasil\n\n"
        "Seja específico e cite as fontes."
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": user_prompt}]
        )
        return resp.content[0].text
    except Exception as e:
        return f"Erro ao gerar síntese: {str(e)}"


@app.post("/api/intel/research")
def intel_research(data: dict):
    """Research any topic using web search + AI synthesis."""
    query   = data.get("query", "").strip()
    sources = data.get("sources", ["all"])
    if not query:
        raise HTTPException(status_code=400, detail="Query vazia")

    conn = get_db()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    s = {r["key"]: r["value"] for r in settings_rows}

    api_key    = s.get("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    serper_key = s.get("serper_api_key", "")
    brave_key  = s.get("brave_api_key", "")

    if not serper_key and not brave_key:
        raise HTTPException(status_code=400, detail="Nenhuma chave de busca configurada. Configure serper_api_key ou brave_api_key em Configurações.")

    # Run searches
    results = _run_intel_searches(query, sources, s)

    # AI synthesis
    synthesis = ""
    if api_key and results:
        synthesis = _build_intel_synthesis(query, results, api_key)

    # Save to intel_history
    conn2 = get_db()
    hid = str(uuid.uuid4())
    conn2.execute(
        "INSERT OR REPLACE INTO intel_history (id, query, sources, results_json, synthesis, created_at) VALUES (?,?,?,?,?,?)",
        (hid, query, json.dumps(sources), json.dumps(results), synthesis, datetime.now().isoformat())
    )
    conn2.commit()
    conn2.close()

    return {
        "id": hid,
        "query": query,
        "results": results,
        "synthesis": synthesis,
        "result_count": len(results),
    }


@app.get("/api/intel/history")
def intel_history(limit: int = 20):
    conn = get_db()
    rows = conn.execute("SELECT id, query, sources, result_count, synthesis, created_at FROM intel_history ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.delete("/api/intel/history/{hid}")
def intel_delete(hid: str):
    conn = get_db()
    conn.execute("DELETE FROM intel_history WHERE id=?", (hid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── Email Alerts ──────────────────────────────────────────────────────────────

def _send_email(to_addr: str, subject: str, html_body: str, s: dict) -> dict:
    """Send an email using SMTP settings from the settings dict."""
    smtp_host = s.get("smtp_host", "smtp.gmail.com")
    smtp_port = int(s.get("smtp_port", "587") or "587")
    smtp_user = s.get("smtp_user", "")
    smtp_pass = s.get("smtp_pass", "")
    from_addr = smtp_user or s.get("emailAddr", "")

    if not smtp_user or not smtp_pass or not to_addr:
        return {"ok": False, "error": "SMTP não configurado (smtp_user / smtp_pass / emailAddr)"}

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = from_addr
    msg["To"]      = to_addr
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as srv:
            srv.ehlo()
            srv.starttls(context=ctx)
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(from_addr, to_addr, msg.as_string())
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _build_alert_email_html(alerts: list, campaigns: list) -> str:
    """Build HTML email body for campaign alerts."""
    now = datetime.now().strftime("%d/%m/%Y %H:%M")

    # Build campaign lookup for metrics
    camp_map = {c["id"]: c for c in campaigns} if campaigns else {}

    rows_html = ""
    for a in alerts:
        camp = camp_map.get(a.get("campaign_id", ""), {})
        spend  = f"${float(a.get('spend') or camp.get('spend') or 0):.2f}"
        roas   = f"{float(camp.get('roas') or 0):.2f}x"
        status = a.get("severity", "warning")
        color  = "#ef4444" if status == "critical" else "#f59e0b"
        icon   = "🔴" if status == "critical" else "⚠️"
        rows_html += f"""
        <tr>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0;">{icon} {a.get('campaign_name','—')}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:{color}; font-weight:600;">{a.get('severity','warning').upper()}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#94a3b8;">{a.get('message','')}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0;">{spend}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #1e293b; color:#e2e8f0;">{roas}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">📊</div>
        <div>
          <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">Meta Ads — Alertas</h1>
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">{now}</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">
      <p style="color:#cbd5e1;font-size:14px;margin:0 0 16px;">
        Foram detectadas <strong style="color:#f87171;">{len(alerts)} campanha(s)</strong> que precisam de atenção.
        Verifique e considere pausar ou ajustar o orçamento.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0f172a;">
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Campanha</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Nível</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Motivo</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Gasto</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>

      <div style="margin-top:20px;padding:12px 16px;background:#0f172a;border-radius:10px;border-left:3px solid #3b82f6;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">
          Acesse a plataforma para tomar ação: pause campanhas, ajuste orçamentos ou altere segmentações conforme necessário.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #334155;">
      <p style="margin:0;color:#475569;font-size:11px;text-align:center;">Meta Ads Control Center — Alerta automático</p>
    </div>
  </div>
</body>
</html>"""


@app.post("/api/alerts/send-email")
def send_alert_email(data: dict = {}):
    """Send email with current active alerts + optional specific campaign list."""
    conn = get_db()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    s = {r["key"]: r["value"] for r in settings_rows}

    # Get alerts to send
    alert_ids = data.get("alert_ids", [])
    if alert_ids:
        placeholders = ",".join("?" * len(alert_ids))
        alerts = [dict(r) for r in conn.execute(f"SELECT * FROM alerts WHERE id IN ({placeholders})", alert_ids).fetchall()]
    else:
        alerts = [dict(r) for r in conn.execute("SELECT * FROM alerts WHERE status='active' ORDER BY severity DESC, created_at DESC LIMIT 20").fetchall()]

    # Get campaign metrics for enrichment
    try:
        campaigns = [dict(r) for r in conn.execute("SELECT * FROM campaigns LIMIT 500").fetchall()]
    except Exception:
        campaigns = []
    conn.close()

    if not alerts:
        return {"ok": False, "error": "Nenhum alerta ativo para enviar"}

    to_addr = data.get("to", s.get("emailAddr", s.get("email_alert_to", "")))
    subject = data.get("subject", f"Meta Ads — {len(alerts)} alerta(s) de campanha [{datetime.now().strftime('%d/%m/%Y %H:%M')}]")
    html_body = _build_alert_email_html(alerts, campaigns)
    result = _send_email(to_addr, subject, html_body, s)
    return result


@app.post("/api/alerts/test-email")
def test_alert_email(data: dict = {}):
    """Send a test email to verify SMTP config."""
    conn = get_db()
    settings_rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    s = {r["key"]: r["value"] for r in settings_rows}
    to_addr = data.get("to", s.get("emailAddr", ""))
    if not to_addr:
        raise HTTPException(status_code=400, detail="Email de destino não configurado em Configurações")
    html = f"""<div style="font-family:Arial;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#3b82f6;">✅ Email de teste — Meta Ads</h2>
        <p>Configuração de email funcionando! Você receberá alertas de campanhas neste endereço.</p>
        <p style="color:#64748b;font-size:12px;">{datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
    </div>"""
    result = _send_email(to_addr, "Teste — Meta Ads Control Center", html, s)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, reload_dirs=[BASE_DIR])
