"""
Sync service: campaign snapshots, session diffs, BM account sync, product/country parsing.
"""
import uuid
import re as _re
from backend.core.db import get_db
from backend.core.settings import _get_active_accounts
from backend.integrations.meta_client import fetch_meta_campaigns, fetch_bm_ad_accounts

# Status code 1 = ACTIVE in Meta API
_ACCT_STATUS_MAP = {1: "active", 2: "disabled", 3: "unsettled", 9: "in_grace_period", 101: "closed"}

_COUNTRY_RE = ['BR','US','MX','AR','CL','CO','PE','EC','UY','PY','BO','VE','ES','PT','GB','CA','AU','DE','FR','IT']
_STOP_WORDS = ['conversao','conversão','traffic','trafego','tráfego','retargeting','cold','warm','hot',
               'video','imagem','carrossel','aquisicao','aquisição','lookalike','lal','cbo','abo',
               'prospeccao','prospecção','remarketing','awareness','reach','alcance','vendas','sales',
               'purchase','compra','scale','teste','test','new','old','copy','v2','v3','v4','fase']

STATUS_MAP = {"done":"approved","complete":"approved","closed":"approved",
              "progress":"testing","doing":"testing","in progress":"testing",
              "reject":"rejected","cancel":"rejected","recusado":"rejected"}


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


def _parse_product_country(campaign_name: str):
    """Extract (product_name, country_code) from a campaign name."""
    name_upper = campaign_name.upper()
    country = None
    for cc in _COUNTRY_RE:
        if _re.search(r'(?:^|[\s_\-|/\.])' + cc + r'(?:$|[\s_\-|/\.])', name_upper):
            country = cc
            break
    product = campaign_name
    if country:
        product = _re.sub(r'(?:^|[\s_\-|/\.])' + country + r'(?:$|[\s_\-|/\.])', ' ', product, flags=_re.IGNORECASE)
    for sw in _STOP_WORDS:
        product = _re.sub(r'(?:^|[\s_\-|/\.])' + _re.escape(sw) + r'(?:$|[\s_\-|/\.])', ' ', product, flags=_re.IGNORECASE)
    product = _re.sub(r'\b(20\d\d|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b', '', product, flags=_re.IGNORECASE)
    product = _re.sub(r'[\s_\-|/\.]+', ' ', product).strip()
    return product or campaign_name.strip(), country
