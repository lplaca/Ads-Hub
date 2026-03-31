"""
Database connection, initialization, and migration utilities.
"""
import os, sqlite3, uuid
import re as _re
from datetime import datetime
from backend.core.config import DATABASE_URL, DB_PATH

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
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT DEFAULT '',
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'open',
            priority TEXT DEFAULT 'normal',
            due_date TEXT DEFAULT '',
            responsible TEXT DEFAULT '',
            origin TEXT DEFAULT 'platform',
            clickup_task_id TEXT DEFAULT '',
            alert_id TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        # ETAPA 3 — vincular alertas ao projeto + campos de ação
        "ALTER TABLE alerts ADD COLUMN project_id TEXT DEFAULT ''",
        "ALTER TABLE alerts ADD COLUMN recommendation TEXT DEFAULT ''",
        "ALTER TABLE alerts ADD COLUMN impact_estimate TEXT DEFAULT ''",
        "ALTER TABLE alerts ADD COLUMN responsible TEXT DEFAULT ''",
        # ETAPA 3 — expandir projetos com campos operacionais
        "ALTER TABLE projects ADD COLUMN client_name TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'",
        "ALTER TABLE projects ADD COLUMN monthly_budget REAL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN goal_roas REAL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN goal_cpa REAL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN goal_spend REAL DEFAULT 0",
        "ALTER TABLE projects ADD COLUMN countries TEXT DEFAULT '[]'",
        "ALTER TABLE projects ADD COLUMN notes TEXT DEFAULT ''",
        "ALTER TABLE projects ADD COLUMN notion_page_id TEXT DEFAULT ''",
    ]
    for m in migrations:
        try:
            conn.execute(m)
            conn.commit()
        except Exception:
            pass  # Column already exists

    # Products table (marketing products per project)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            project_id TEXT DEFAULT '',
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            sku TEXT DEFAULT '',
            price REAL DEFAULT 0,
            category TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            landing_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()

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
