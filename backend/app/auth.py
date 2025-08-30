from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session as DBSession
from uuid import uuid4
from .db import SessionLocal
from .models import Teacher, Session as SessionModel
from .security import verify_password, hash_password, validate_password, random_token, new_session_expiry
from .config import settings
from .audit import audit

router = APIRouter(prefix="/auth", tags=["auth"])

def _set_cookies(resp: Response, sid: str, csrf: str):
    secure_flag = (settings.APP_ENV != "development")
    resp.set_cookie(
        settings.SESSION_COOKIE_NAME, sid,
        httponly=True, samesite="lax", secure=secure_flag, path="/"
    )
    # CSRF token is readable by JS (not HttpOnly)
    resp.set_cookie(
        settings.CSRF_COOKIE_NAME, csrf,
        httponly=False, samesite="lax", secure=secure_flag, path="/"
    )

@router.post("/login")
def login(payload: dict, request: Request):
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    remember = bool(payload.get("remember", True))

    with SessionLocal() as db:
        q = db.query(Teacher)
        if username:
            q = q.filter(Teacher.username == username)
        elif email:
            q = q.filter(Teacher.email == email)
        user = q.first()

        if not user or user.status != "active" or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

        # Create session
        sid = str(uuid4())
        csrf = random_token(16)
        expires_at = new_session_expiry()
        sess = SessionModel(
            id=sid,
            user_id=user.id,
            role=("rooter" if user.username == "rooter" else "teacher"),
            csrf_token=csrf,
            expires_at=expires_at,
            last_seen_ip=(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
        )
        db.add(sess)
        db.commit()

        resp = Response(content='{"ok": true}', media_type="application/json")
        _set_cookies(resp, sid, csrf)

        audit(
            db,
            actor_id=user.id,
            actor_role=("rooter" if user.username == "rooter" else "teacher"),
            action="login_success",
            entity_type="session",
            entity_id=sid,
            ip=(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
        )
        return resp

@router.post("/logout")
def logout(request: Request):
    sid = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not sid:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    with SessionLocal() as db:
        sess = db.query(SessionModel).filter(SessionModel.id == sid).first()
        if sess:
            db.delete(sess)
            db.commit()
        resp = Response(status_code=status.HTTP_204_NO_CONTENT)
        resp.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")
        resp.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")
        return resp
