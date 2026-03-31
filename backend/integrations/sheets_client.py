"""
Google Sheets sync client.
"""
import json, uuid
from datetime import datetime
from backend.core.db import get_db
from backend.core.config import GOOGLE_AVAILABLE

if GOOGLE_AVAILABLE:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build as google_build


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
