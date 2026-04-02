"""
Spreadsheet import domain: CSV/XLSX upload and batch campaign launch.
"""
import csv, io, json, re, threading, uuid
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from backend.core.config import _launch_threads
from backend.core.db import get_db
from backend.integrations.meta_client import CTA_MAP
from backend.services.launcher_service import create_full_campaign

router = APIRouter()

# ── Column name → internal field mapping (all keys must be lowercase, stripped) ──
COLUMN_MAP: dict[str, str] = {
    # nome_produto
    "nome_produto": "nome_produto", "produto": "nome_produto",
    "name": "nome_produto", "product": "nome_produto",
    # url_destino
    "url_destino": "url_destino", "link": "url_destino",
    "url": "url_destino", "destination": "url_destino",
    # texto_principal
    "texto_principal": "texto_principal", "copy": "texto_principal",
    "texto": "texto_principal", "text": "texto_principal",
    # titulo
    "titulo": "titulo", "title": "titulo", "headline": "titulo",
    # descricao
    "descricao": "descricao", "description": "descricao", "desc": "descricao",
    # cta
    "cta": "cta",
    # urls_videos
    "urls_videos": "urls_videos", "videos": "urls_videos",
    "video_urls": "urls_videos", "links_videos": "urls_videos",
    # paises
    "paises": "paises", "countries": "paises", "country": "paises",
    "país": "paises", "pais": "paises",
    # idade
    "idade_min": "idade_min", "age_min": "idade_min", "min_age": "idade_min",
    "idade_max": "idade_max", "age_max": "idade_max", "max_age": "idade_max",
    # genero
    "genero": "genero", "gender": "genero", "sexo": "genero",
    # budget
    "budget": "budget_diario_usd", "budget_diario": "budget_diario_usd",
    "daily_budget": "budget_diario_usd", "budget_diario_usd": "budget_diario_usd",
    # horario
    "horario_inicio": "horario_inicio", "start_time": "horario_inicio",
    "horario": "horario_inicio",
    # conta
    "conta": "ad_account_id", "ad_account": "ad_account_id",
    "account_id": "ad_account_id",
    # pagina
    "pagina": "page_id", "page_id": "page_id", "page": "page_id",
    "página": "page_id",
    # pixel
    "pixel": "pixel_id", "pixel_id": "pixel_id",
    # token
    "token": "access_token", "access_token": "access_token",
}

VALID_CTAS = {"SHOP_NOW", "LEARN_MORE", "SIGN_UP", "BUY_NOW", "GET_OFFER", "BOOK_NOW"}


def _parse_rows(headers: list, data_rows: list) -> dict:
    """Map spreadsheet headers + rows to internal fields."""
    col_mapping: dict[str, str] = {}  # original_header -> internal_field
    for h in headers:
        key = h.strip().lower()
        if key in COLUMN_MAP:
            col_mapping[h] = COLUMN_MAP[key]

    mapped_originals = list(col_mapping.keys())
    ignored_cols = [h for h in headers if h not in col_mapping]
    mapped_fields = sorted(set(col_mapping.values()))

    rows = []
    for idx, raw_row in enumerate(data_rows):
        row_dict = dict(zip(headers, raw_row))
        internal: dict = {"row_index": idx + 1}
        warnings: list[str] = []

        for orig_col, field in col_mapping.items():
            val = str(row_dict.get(orig_col, "") or "").strip()
            if not val:
                continue

            if field == "urls_videos":
                parts = [u.strip() for u in re.split(r"[|,;]", val) if u.strip()]
                internal[field] = parts
            elif field == "paises":
                parts = [p.strip().upper() for p in val.split(",") if p.strip()]
                internal[field] = parts
            elif field == "idade_min":
                try:
                    internal[field] = int(val)
                except ValueError:
                    internal[field] = 18
            elif field == "idade_max":
                try:
                    internal[field] = int(val)
                except ValueError:
                    internal[field] = 65
            elif field == "budget_diario_usd":
                try:
                    internal[field] = float(val.replace(",", "."))
                except ValueError:
                    internal[field] = 10.0
            elif field == "cta":
                cta_up = val.upper()
                mapped = CTA_MAP.get(cta_up)
                if mapped:
                    internal[field] = mapped
                elif cta_up in VALID_CTAS:
                    internal[field] = cta_up
                else:
                    internal[field] = "SHOP_NOW"
                    warnings.append(f"CTA inválido '{val}' → substituído por SHOP_NOW")
            else:
                internal[field] = val

        # Defaults for optional fields
        internal.setdefault("cta", "SHOP_NOW")
        internal.setdefault("idade_min", 18)
        internal.setdefault("idade_max", 65)
        internal.setdefault("genero", "ALL")
        internal.setdefault("budget_diario_usd", 10.0)
        internal.setdefault("horario_inicio", "00:00")
        internal.setdefault("urls_videos", [])
        internal.setdefault("paises", [])

        # Required field check
        missing = []
        if not internal.get("nome_produto"):
            missing.append("nome_produto")
        if not internal.get("urls_videos"):
            missing.append("urls_videos")
        if not internal.get("url_destino"):
            missing.append("url_destino")

        internal["missing_fields"] = missing
        internal["warnings"] = warnings
        rows.append(internal)

    return {
        "rows": rows,
        "total_rows": len(rows),
        "columns_detected": headers,
        "columns_mapped": mapped_originals,
        "columns_ignored": ignored_cols,
    }


@router.post("/api/import/upload")
async def upload_spreadsheet(file: UploadFile = File(...)):
    """Accept .csv or .xlsx and return parsed rows with field mapping info."""
    filename = (file.filename or "").lower()
    content = await file.read()

    if filename.endswith(".xlsx"):
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="openpyxl não está instalado. Execute: pip install openpyxl",
            )
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo XLSX: {e}")

        if not all_rows:
            raise HTTPException(status_code=400, detail="Planilha vazia")

        headers = [str(c) if c is not None else "" for c in all_rows[0]]
        data_rows = [
            [str(c) if c is not None else "" for c in row]
            for row in all_rows[1:]
            if any(c is not None for c in row)
        ]

    elif filename.endswith(".csv"):
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
        reader = csv.reader(io.StringIO(text))
        all_rows = list(reader)
        if not all_rows:
            raise HTTPException(status_code=400, detail="Arquivo CSV vazio")
        headers = [h.strip() for h in all_rows[0]]
        data_rows = [r for r in all_rows[1:] if any(c.strip() for c in r)]

    else:
        raise HTTPException(
            status_code=400,
            detail="Formato não suportado. Envie um arquivo .csv ou .xlsx",
        )

    return _parse_rows(headers, data_rows)


@router.post("/api/import/launch-batch")
def launch_batch(data: dict):
    """
    Launch campaigns for a batch of parsed rows.
    If dry_run=true, only validates and returns preview without creating anything.
    """
    rows = data.get("rows", [])
    dry_run = data.get("dry_run", False)

    if not rows:
        raise HTTPException(status_code=400, detail="Nenhuma linha fornecida")

    jobs = []
    today_str = datetime.now().strftime("%d/%m")

    for row in rows:
        row_index = row.get("row_index", 0)
        nome = row.get("nome_produto", f"Produto_{row_index}")
        countries = row.get("paises") or ["BR"]
        first_country = countries[0] if countries else "BR"

        if dry_run:
            jobs.append({
                "row_index": row_index,
                "nome_produto": nome,
                "job_id": None,
                "status": "dry_run",
                "preview": {
                    "campaign_name": f"[{first_country}] [ABO] [{nome.upper()}] [{today_str}]",
                    "videos": len(row.get("urls_videos", [])),
                    "countries": countries,
                    "budget_diario_usd": row.get("budget_diario_usd", 10.0),
                    "ad_account_id": row.get("ad_account_id", ""),
                    "page_id": row.get("page_id", ""),
                    "pixel_id": row.get("pixel_id", ""),
                },
            })
            continue

        # Validate required account fields
        access_token = row.get("access_token", "")
        ad_account_id = row.get("ad_account_id", "")
        if not access_token or not ad_account_id:
            jobs.append({
                "row_index": row_index,
                "nome_produto": nome,
                "job_id": None,
                "status": "error",
                "error": "access_token e ad_account_id são obrigatórios para lançar",
            })
            continue

        account = {
            "access_token": access_token,
            "ad_account_id": ad_account_id,
            "page_id": row.get("page_id", ""),
            "pixel_id": row.get("pixel_id", ""),
        }

        # Insert temporary imported_products record
        product_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())
        urls_videos = row.get("urls_videos", [])
        paises = row.get("paises", [])

        conn = get_db()
        try:
            conn.execute(
                """
                INSERT INTO imported_products
                (id, config_id, nome_produto, url_destino, texto_principal, titulo,
                 descricao, cta, urls_videos, paises, idade_min, idade_max, genero,
                 budget_diario_usd, horario_inicio, launch_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'launching')
                """,
                (
                    product_id,
                    f"import_{row_index}",
                    nome,
                    row.get("url_destino", ""),
                    row.get("texto_principal", ""),
                    row.get("titulo", ""),
                    row.get("descricao", ""),
                    row.get("cta", "SHOP_NOW"),
                    json.dumps(urls_videos),
                    json.dumps(paises),
                    row.get("idade_min", 18),
                    row.get("idade_max", 65),
                    row.get("genero", "ALL"),
                    row.get("budget_diario_usd", 10.0),
                    row.get("horario_inicio", "00:00"),
                ),
            )
            conn.execute(
                """
                INSERT INTO launch_jobs
                (id, product_id, product_name, status, step, step_detail, total_videos, started_at)
                VALUES (?, ?, ?, 'queued', 'starting', 'Preparando lançamento...', ?, ?)
                """,
                (job_id, product_id, nome, len(urls_videos), datetime.now().isoformat()),
            )
            conn.commit()
        except Exception as e:
            conn.close()
            jobs.append({
                "row_index": row_index,
                "nome_produto": nome,
                "job_id": None,
                "status": "error",
                "error": str(e),
            })
            continue
        conn.close()

        # Build product dict — urls_videos and paises are already lists
        product = {
            "id": product_id,
            "nome_produto": nome,
            "url_destino": row.get("url_destino", ""),
            "texto_principal": row.get("texto_principal", ""),
            "titulo": row.get("titulo", ""),
            "descricao": row.get("descricao", ""),
            "cta": row.get("cta", "SHOP_NOW"),
            "urls_videos": urls_videos,   # list — launcher_service handles this
            "paises": paises,             # list — launcher_service handles this
            "idade_min": row.get("idade_min", 18),
            "idade_max": row.get("idade_max", 65),
            "genero": row.get("genero", "ALL"),
            "budget_diario_usd": row.get("budget_diario_usd", 10.0),
            "horario_inicio": row.get("horario_inicio", "00:00"),
        }

        t = threading.Thread(
            target=create_full_campaign, args=(job_id, product, account), daemon=True
        )
        _launch_threads[job_id] = t
        t.start()

        jobs.append({
            "row_index": row_index,
            "nome_produto": nome,
            "job_id": job_id,
            "status": "queued",
        })

    return {"jobs": jobs}
