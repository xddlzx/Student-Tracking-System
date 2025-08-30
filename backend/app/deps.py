from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session as DBSession
from .db import SessionLocal
from .config import settings

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def require_csrf(request: Request):
    # Double submit: header must equal cookie value; cookie itself is not HttpOnly.
    token_header = request.headers.get("X-CSRF-Token")
    token_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)    
    if not token_header or not token_cookie or token_header != token_cookie:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="csrf_mismatch")
