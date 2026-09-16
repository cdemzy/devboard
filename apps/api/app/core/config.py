from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:54322/postgres"
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_publishable_key: str = ""
    auth_identity_cache_ttl_seconds: int = 60
    cors_origins: list[str] = ["http://localhost:3000"]
    # Optional regex for dynamic hosts (e.g. Vercel preview URLs). Uses fullmatch.
    cors_origin_regex: str | None = None
    # Keep OpenAPI UI off unless explicitly enabled (local only).
    enable_docs: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
