"""
Knowledge base, AI products, chat, and ideas routes.
"""
import json, os, uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
import anthropic
from backend.core.db import get_db
from backend.core.settings import get_setting
from backend.integrations.ai_client import (
    get_db_products, get_db_knowledge,
    get_campaigns_for_agent, build_agent_system_prompt,
    _strip_json,
)

router = APIRouter()


# ─── AI PRODUCTS ───────────────────────────────────────────────────────────────

@router.get("/api/ai-products")
def list_ai_products():
    return get_db_products()


@router.get("/api/ai-products/by-country")
def list_ai_products_by_country():
    """Return products grouped by country code."""
    products = get_db_products()
    groups: dict = {}
    for p in products:
        c = (p.get("country") or "").strip().lower() or "other"
        groups.setdefault(c, []).append(p)
    return [{"country": c, "products": prods} for c, prods in sorted(groups.items())]


@router.post("/api/ai-products")
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


@router.put("/api/ai-products/{pid}")
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


@router.delete("/api/ai-products/{pid}")
def delete_ai_product(pid: str):
    conn = get_db()
    conn.execute("DELETE FROM ai_products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ─── KNOWLEDGE BASE ────────────────────────────────────────────────────────────

@router.get("/api/knowledge-base")
def list_knowledge():
    return get_db_knowledge()


@router.post("/api/knowledge-base")
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


@router.put("/api/knowledge-base/{kid}")
def update_knowledge(kid: str, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE ai_knowledge SET category=?, title=?, content=? WHERE id=?",
        (data.get("category"), data.get("title"), data.get("content"), kid)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.delete("/api/knowledge-base/{kid}")
def delete_knowledge(kid: str):
    conn = get_db()
    conn.execute("DELETE FROM ai_knowledge WHERE id=?", (kid,))
    conn.commit()
    conn.close()
    return {"status": "success"}


# ─── CHAT ──────────────────────────────────────────────────────────────────────

@router.get("/api/chat/messages")
def get_chat_messages(limit: int = 40):
    conn = get_db()
    rows = conn.execute("SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/chat/send")
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


@router.delete("/api/chat/clear")
def clear_chat():
    conn = get_db()
    conn.execute("DELETE FROM chat_messages")
    conn.commit()
    conn.close()
    return {"status": "success"}


# ─── IDEAS ─────────────────────────────────────────────────────────────────────

@router.get("/api/ideas")
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


@router.post("/api/ideas/generate")
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


@router.put("/api/ideas/{iid}/status")
def update_idea_status(iid: str, data: dict):
    conn = get_db()
    conn.execute("UPDATE ai_ideas SET status=? WHERE id=?", (data.get("status", "new"), iid))
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.delete("/api/ideas/{iid}")
def delete_idea(iid: str):
    conn = get_db()
    conn.execute("DELETE FROM ai_ideas WHERE id=?", (iid,))
    conn.commit()
    conn.close()
    return {"status": "success"}
