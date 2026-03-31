"""
Web Intelligence (Intel) domain routes.
"""
import json, os, uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
import requests as http_req
import anthropic
from backend.core.db import get_db

router = APIRouter()


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


@router.post("/api/intel/research")
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


@router.get("/api/intel/history")
def intel_history(limit: int = 20):
    conn = get_db()
    rows = conn.execute("SELECT id, query, sources, result_count, synthesis, created_at FROM intel_history ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/api/intel/history/{hid}")
def intel_delete(hid: str):
    conn = get_db()
    conn.execute("DELETE FROM intel_history WHERE id=?", (hid,))
    conn.commit()
    conn.close()
    return {"ok": True}
