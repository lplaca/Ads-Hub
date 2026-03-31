"""
Auth domain routes.
"""
import uuid, secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from backend.core.db import get_db
from backend.core.config import SESSION_SECRET
from backend.core.auth import _hash_pw, _verify_pw, _create_stateless_token, _get_current_user

router = APIRouter()


@router.get("/api/auth/status")
def auth_status():
    """Returns whether any user exists (setup needed or not)."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return {"has_users": count > 0}


@router.post("/api/auth/setup")
def auth_setup(data: dict):
    """Create the first user (only allowed if no users exist)."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count > 0:
        conn.close()
        raise HTTPException(status_code=403, detail="Usuário já existe. Faça login.")
    email = data.get("email", "").strip().lower()
    pw    = data.get("password", "")
    name  = data.get("name", "").strip()
    if not email or not pw:
        conn.close()
        raise HTTPException(status_code=400, detail="Email e senha obrigatórios")
    uid = str(uuid.uuid4())
    conn.execute("INSERT INTO users (id, email, name, password_hash) VALUES (?,?,?,?)",
                 (uid, email, name, _hash_pw(pw)))
    conn.commit()
    if SESSION_SECRET:
        token = _create_stateless_token(uid, email, name)
    else:
        token = secrets.token_hex(32)
        exp   = (datetime.now() + timedelta(days=30)).isoformat()
        conn.execute("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,?)",
                     (token, uid, exp))
        conn.commit()
    conn.close()
    return {"ok": True, "token": token, "user": {"id": uid, "email": email, "name": name}}


@router.post("/api/auth/login")
def auth_login(data: dict):
    email = data.get("email", "").strip().lower()
    pw    = data.get("password", "")
    conn  = get_db()
    user  = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not _verify_pw(pw, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    if SESSION_SECRET:
        token = _create_stateless_token(user["id"], user["email"], user["name"])
        conn.close()
    else:
        token = secrets.token_hex(32)
        exp   = (datetime.now() + timedelta(days=30)).isoformat()
        conn.execute("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?,?,?)",
                     (token, user["id"], exp))
        conn.commit()
        conn.close()
    return {"ok": True, "token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@router.post("/api/auth/logout")
def auth_logout(data: dict):
    token = data.get("token", "")
    if token:
        conn = get_db()
        conn.execute("DELETE FROM user_sessions WHERE token=?", (token,))
        conn.commit()
        conn.close()
    return {"ok": True}


@router.get("/api/auth/me")
def auth_me(request: Request):
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


@router.put("/api/auth/me")
def auth_update_me(request: Request, data: dict):
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user["user_id"],)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    new_name  = data.get("name", row["name"])
    new_email = data.get("email", row["email"]).strip().lower()
    updates = [(new_name, new_email, row["id"])]
    conn.execute("UPDATE users SET name=?, email=? WHERE id=?", updates[0])
    if data.get("new_password"):
        if not data.get("current_password"):
            conn.close()
            raise HTTPException(status_code=400, detail="Senha atual obrigatória")
        if not _verify_pw(data["current_password"], row["password_hash"]):
            conn.close()
            raise HTTPException(status_code=400, detail="Senha atual incorreta")
        conn.execute("UPDATE users SET password_hash=? WHERE id=?",
                     (_hash_pw(data["new_password"]), row["id"]))
    conn.commit()
    conn.close()
    return {"ok": True, "user": {"id": row["id"], "email": new_email, "name": new_name}}
