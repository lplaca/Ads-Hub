"""
Campaign launcher service: background thread to create full Meta campaigns.
"""
import json, os, time
from datetime import datetime, timedelta
from backend.core.db import get_db
from backend.core.config import _launch_threads
from backend.integrations.meta_client import meta_post, CTA_MAP, COUNTRY_NAMES


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
    from backend.integrations.meta_client import meta_get
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
    import requests as http_req
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
