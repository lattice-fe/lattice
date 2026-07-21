from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.constants import EMBEDDING_DIM


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    database_url: str = "sqlite+pysqlite:///data/index.db"
    storage_root: str = "./data/uploads"

    # Mirrors app.constants.EMBEDDING_DIM; used at boot to validate the
    # configured embedding model's output dimension matches the fixed
    # pgvector column width. See app/providers/embedding.py for the
    # migration runbook when this needs to change.
    embedding_dim: int = EMBEDDING_DIM

    chat_provider: str = "openai"  # use omniroute via OpenAI-compatible API
    chat_model: str = "kr/glm-5"  # pinned omniroute model (avoids flaky auto/* routing)
    chat_base_url: str = "http://localhost:20128/v1"  # omniroute proxy
    # "local" runs sentence-transformers on CPU, no API key required — see
    # app/providers/embedding.py:LocalEmbeddingProvider. Swap to a hosted
    # provider (openai/text-embedding-3-small, etc.) via the migration
    # runbook there, not by editing this value alone.
    embedding_provider: str = "local"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    # Used by the summarization/consolidation pipeline ("understanding").
    groq_api_key: str | None = None
    # Used by the interactive Ask endpoint — a separate key so the two don't
    # compete for the same Groq free-tier TPM budget. Falls back to
    # groq_api_key above if unset.
    groq_api_key_chats: str | None = None
    # Omniroute proxy (aggregator of free-tier APIs)
    omniroute_api_key: str | None = None
    omniroute_base_url: str = "http://localhost:20128/v1"

    job_poll_interval_seconds: float = 1.0
    job_max_attempts: int = 5

    # How often the scheduler loop wakes to check due-ness. Actual cadence of
    # each action is governed by its own threshold (source.config's
    # poll_interval_seconds; consolidation_min_new_summaries / _max_wait_minutes
    # below) — this just needs to be fine-grained enough not to blur those.
    scheduler_tick_seconds: float = 30.0

    consolidation_min_new_summaries: int = 3
    consolidation_max_wait_minutes: int = 30

    system_principal_id: str = "00000000-0000-0000-0000-000000000000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
