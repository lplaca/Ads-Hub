"""
Chat Launcher domain: natural language → structured campaign parameters → launch.
"""
import json, os, threading, uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from backend.core.config import _launch_threads
from backend.core.db import get_db
from backend.core.settings import get_setting
from backend.services.launcher_service import create_full_campaign

router = APIRouter()

PARSE_SYSTEM_PROMPT = """Você é um assistente especializado em Meta Ads. O usuário vai descrever uma
campanha em linguagem natural (português ou inglês). Extraia os parâmetros
e retorne APENAS um JSON válido, sem markdown, sem explicações.

Campos possíveis (omita campos ausentes, não coloque null):
{
  "nome_produto": "string",
  "ad_account_id": "string (só números ou act_XXXX)",
  "page_id": "string",
  "pixel_id": "string",
  "bm_id": "string",
  "access_token": "string",
  "url_destino": "string",
  "texto_principal": "string",
  "titulo": "string",
  "descricao": "string",
  "cta": "SHOP_NOW|LEARN_MORE|SIGN_UP|BUY_NOW|GET_OFFER",
  "urls_videos": ["url1", "url2"],
  "paises": ["BR", "MX", "CO"],
  "idade_min": number,
  "idade_max": number,
  "genero": "ALL|M|F",
  "budget_diario_usd": number,
  "horario_inicio": "HH:MM",
  "confidence": 0.0-1.0,
  "missing_required": ["campos obrigatórios que estão faltando"],
  "clarification_needed": "string com dúvida específica se necessário"
}

Campos obrigatórios: nome_produto, urls_videos, url_destino.
Se algum campo obrigatório faltar, liste em missing_required."""


def _build_confirmation(parsed: dict) -> str:
    nome = parsed.get("nome_produto", "")
    countries = parsed.get("paises") or ["BR"]
    first_country = countries[0] if countries else "BR"
    today_str = datetime.now().strftime("%d/%m")
    camp_name = f"[{first_country}] [ABO] [{nome.upper()}] [{today_str}]"
    n_videos = len(parsed.get("urls_videos") or [])
    budget = parsed.get("budget_diario_usd", 10.0)
    paises_str = ", ".join(countries)
    return (
        f"Vou criar a campanha '{camp_name}' com {n_videos} vídeo(s) "
        f"para {paises_str}, budget ${budget:.2f}/dia. Confirma?"
    )


@router.post("/api/chat-launcher/parse")
def parse_chat_message(data: dict):
    """
    Uses Anthropic API to extract structured campaign parameters from free text.
    Accumulates conversation context by concatenating prior messages.
    """
    message = data.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Mensagem não pode estar vazia")

    api_key = get_setting("anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Chave Anthropic não configurada. Vá em Configurações → Integrações IA.",
        )

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=PARSE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0].strip()
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail="Claude retornou resposta inesperada. Tente reformular a mensagem.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar com IA: {e}")

    # Ensure missing_required is accurate
    missing = list(parsed.get("missing_required") or [])
    if not parsed.get("nome_produto") and "nome_produto" not in missing:
        missing.append("nome_produto")
    if not parsed.get("urls_videos") and "urls_videos" not in missing:
        missing.append("urls_videos")
    if not parsed.get("url_destino") and "url_destino" not in missing:
        missing.append("url_destino")
    parsed["missing_required"] = missing

    ready = len(missing) == 0
    confirmation_text = _build_confirmation(parsed) if ready else ""

    return {
        "parsed": parsed,
        "ready_to_launch": ready,
        "confirmation_text": confirmation_text,
    }


@router.post("/api/chat-launcher/launch")
def chat_launch(data: dict):
    """
    Creates a temporary product record and spawns a background campaign thread.
    """
    parsed = data.get("parsed") or {}
    if not parsed:
        raise HTTPException(status_code=400, detail="Dados de campanha não fornecidos")

    nome = (parsed.get("nome_produto") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do produto é obrigatório")

    access_token = (parsed.get("access_token") or "").strip()
    ad_account_id = (parsed.get("ad_account_id") or "").strip()
    if not access_token or not ad_account_id:
        raise HTTPException(
            status_code=400,
            detail="access_token e ad_account_id são obrigatórios para lançar a campanha",
        )

    account = {
        "access_token": access_token,
        "ad_account_id": ad_account_id,
        "page_id": parsed.get("page_id", ""),
        "pixel_id": parsed.get("pixel_id", ""),
    }

    urls_videos = parsed.get("urls_videos") or []
    paises = parsed.get("paises") or []

    # Insert temporary product record
    product_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    conn = get_db()
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
            "chat_launcher",
            nome,
            parsed.get("url_destino", ""),
            parsed.get("texto_principal", ""),
            parsed.get("titulo", ""),
            parsed.get("descricao", ""),
            parsed.get("cta", "SHOP_NOW"),
            json.dumps(urls_videos),
            json.dumps(paises),
            parsed.get("idade_min", 18),
            parsed.get("idade_max", 65),
            parsed.get("genero", "ALL"),
            parsed.get("budget_diario_usd", 10.0),
            parsed.get("horario_inicio", "00:00"),
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
    conn.close()

    product = {
        "id": product_id,
        "nome_produto": nome,
        "url_destino": parsed.get("url_destino", ""),
        "texto_principal": parsed.get("texto_principal", ""),
        "titulo": parsed.get("titulo", ""),
        "descricao": parsed.get("descricao", ""),
        "cta": parsed.get("cta", "SHOP_NOW"),
        "urls_videos": urls_videos,   # list — launcher_service handles this
        "paises": paises,             # list — launcher_service handles this
        "idade_min": parsed.get("idade_min", 18),
        "idade_max": parsed.get("idade_max", 65),
        "genero": parsed.get("genero", "ALL"),
        "budget_diario_usd": parsed.get("budget_diario_usd", 10.0),
        "horario_inicio": parsed.get("horario_inicio", "00:00"),
    }

    t = threading.Thread(
        target=create_full_campaign, args=(job_id, product, account), daemon=True
    )
    _launch_threads[job_id] = t
    t.start()

    return {"job_id": job_id, "status": "queued", "product_name": nome}
