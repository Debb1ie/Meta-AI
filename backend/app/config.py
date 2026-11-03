from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'hydrosentinel.db'}"

    # Meta Model API — server-side only, never sent to the browser.
    meta_model_api_key: str = ""
    meta_model_base_url: str = "https://api.meta.ai/v1"
    meta_text_model: str = "muse-spark-1.3"
    meta_segmentation_model: str = "sam-3.1"
    meta_image_model: str = "muse-image-1.0"
    meta_timeout_seconds: float = 90.0
    # Hard cap on tokens a single chat call may generate (reasoning included); a cost guard, not a style limit.
    meta_max_output_tokens: int = 8000

    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    open_meteo_cache_seconds: int = 900

    # Live, keyless open data. Gauges: UK Environment Agency (measured levels, 15 min).
    # Philippine outlook: Open-Meteo Flood API (GloFAS modelled daily river discharge).
    live_data_enabled: bool = True
    live_refresh_minutes: int = 15
    seed_demo_data: bool = False
    ea_base_url: str = "https://environment.data.gov.uk/flood-monitoring"
    open_meteo_flood_url: str = "https://flood-api.open-meteo.com/v1"
    glofas_cache_seconds: int = 3 * 3600
    # Run the flood-watch agent in the background this often (hours); 0 disables. Each run costs a few cents.
    agent_autorun_hours: float = 3.0
    # Required in the X-Admin-Token header for every data-changing endpoint. Empty = those endpoints are disabled.
    admin_token: str = ""
    rate_limits_enabled: bool = True
    # Credit guards for manual runs: reuse a briefing younger than this, and cap paid runs per day.
    agent_cooldown_minutes: float = 10.0
    agent_max_runs_per_day: int = 40

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Optional regex for extra origins, e.g. Vercel preview URLs: https://hydrosentinel.*\.vercel\.app
    cors_origin_regex: str = ""

    @property
    def meta_configured(self) -> bool:
        return bool(self.meta_model_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
