from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # App
    app_name: str = "WorldMonitor"
    debug: bool = False

    # Database (SQLite for dev, PostgreSQL for prod)
    database_url: str = "sqlite+aiosqlite:///./worldmonitor.db"

    # Auth / JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Redis (optional — gracefully degrades to in-memory only)
    redis_url: str | None = None

    # Vertex AI / Gemini Flash (source detection)
    gcp_project: str = "gen-lang-client-0965475468"
    gcp_location: str = "us-central1"
    gemini_model: str = "google/gemini-2.5-flash"

    # Secrets encryption key (Fernet)
    secrets_key: str = "change-me-in-production"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"]


settings = Settings()
