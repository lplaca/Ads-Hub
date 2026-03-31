"""
Authentication utilities: password hashing, stateless tokens, user lookup.
"""
import hashlib, secrets, hmac, base64, json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Request
from backend.core.db import get_db
from backend.core.config import SESSION_SECRET


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
