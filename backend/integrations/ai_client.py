"""
AI client: Claude (Anthropic) and OpenAI integration for agent cycles and rule parsing.
"""
import json, os
from datetime import datetime
from typing import Optional
import anthropic
import openai as openai_lib

from backend.core.db import get_db
from backend.core.settings import _get_active_accounts

# ── Constants ─────────────────────────────────────────────────────────────────

MOCK_CAMPAIGNS = []

AI_RULE_SYSTEM = """Você é um assistente especialista em tráfego pago (Meta Ads, Google Ads, TikTok Ads). O usuário vai descrever uma regra de automação em linguagem natural e você deve convertê-la em JSON estruturado.

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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_json(raw: str) -> str:
    """Remove markdown code fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


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
    prompt = """Você é um gestor de tráfego pago especialista em Meta Ads, Google Ads e TikTok Ads com anos de experiência gerenciando campanhas de alto volume e ROI. Você trabalha 24/7 analisando campanhas, protegendo orçamento e identificando oportunidades.

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
    from backend.integrations.meta_client import fetch_meta_campaigns, fetch_meta_insights
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
    from backend.integrations.meta_client import pause_meta_campaign
    from backend.core.settings import get_active_project_id
    import uuid
    active_pid = get_active_project_id()
    if not active_pid:
        return {
            "error": "no_active_project",
            "message": "Nenhum projeto ativo para analisar. Selecione um projeto.",
            "cycle_id": None, "analysis": None, "actions_taken": 0, "campaigns_analyzed": 0
        }
    products = get_db_products()
    knowledge = get_db_knowledge()
    autonomy = int(get_agent_config("autonomy_level", "1"))
    campaigns, is_demo = get_campaigns_for_agent()
    if not campaigns and not is_demo:
        return {
            "error": "no_campaigns",
            "message": "Nenhuma campanha disponível. Verifique se as conexões Meta Ads estão sincronizadas.",
            "cycle_id": None, "analysis": None, "actions_taken": 0, "campaigns_analyzed": 0
        }

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
