import secrets, re
from datetime import datetime, timedelta, timezone
from passlib.hash import argon2
from .config import settings

def hash_password(password: str) -> str:
    return argon2.using(time_cost=3, memory_cost=65536, parallelism=2).hash(password)

def verify_password(password: str, hashval: str) -> bool:
    try:
        return argon2.verify(password, hashval)
    except Exception:
        return False

def validate_password(pw: str) -> list[str]:
    errors: list[str] = []
    if len(pw or "") < settings.PASSWORD_MIN_LENGTH:
        errors.append("minimum_length")
    if settings.PASSWORD_REQUIRE_NUMBER and not re.search(r"[0-9]", pw or ""):
        errors.append("require_number")
    if settings.PASSWORD_REQUIRE_UPPER and not re.search(r"[A-ZÇĞİÖŞÜ]", pw or ""):
        errors.append("require_upper")
    if settings.PASSWORD_REQUIRE_SYMBOL and not re.search(r"[^A-Za-z0-9]", pw or ""):
        errors.append("require_symbol")
    return errors

def new_session_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.SESSION_TTL_SECONDS)

def random_token(n=32) -> str:
    return secrets.token_hex(n)
