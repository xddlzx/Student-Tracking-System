import os

class Settings:
    APP_ENV = os.getenv("APP_ENV", "production")
    APP_SECRET = os.getenv("APP_SECRET", "dev-secret")
    TZ = os.getenv("TZ", "Europe/Istanbul")

    DB_HOST = os.getenv("POSTGRES_HOST", "db")
    DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
    DB_USER = os.getenv("POSTGRES_USER", "lgs_user")
    DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
    DB_NAME = os.getenv("POSTGRES_DB", "lgs_db")

    SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "lgs_session")
    CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "lgs_csrf")
    SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "2592000"))

    RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    RATE_LIMIT_MAX_AUTH_ATTEMPTS = int(os.getenv("RATE_LIMIT_MAX_AUTH_ATTEMPTS", "15"))

    PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "10"))
    PASSWORD_REQUIRE_SYMBOL = bool(int(os.getenv("PASSWORD_REQUIRE_SYMBOL", "1")))
    PASSWORD_REQUIRE_NUMBER = bool(int(os.getenv("PASSWORD_REQUIRE_NUMBER", "1")))
    PASSWORD_REQUIRE_UPPER = bool(int(os.getenv("PASSWORD_REQUIRE_UPPER", "1")))

    TEACHER_GLOBAL_ACCESS = bool(int(os.getenv("TEACHER_GLOBAL_ACCESS", "1"))) #NEW!!!

    ROOTER_USERNAME = os.getenv("ROOTER_USERNAME", "rooter")
    ROOTER_EMAIL = os.getenv("ROOTER_EMAIL", "rooter@example.edu.tr")
    ROOTER_PASSWORD = os.getenv("ROOTER_PASSWORD", "ChangeMe!123")

settings = Settings()
