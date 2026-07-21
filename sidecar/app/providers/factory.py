from functools import lru_cache

from app.config import get_settings
from app.constants import EMBEDDING_DIM
from app.providers.chat import ChatProvider, LiteLLMChatProvider
from app.providers.embedding import (
    EmbeddingDimensionMismatch,
    EmbeddingProvider,
    LiteLLMEmbeddingProvider,
    LocalEmbeddingProvider,
)

# provider_name -> (litellm model prefix, known dimension) for the embedding
# models this deployment has validated against EMBEDDING_DIM. Extend this map
# when onboarding a new embedding provider/model.
_KNOWN_EMBEDDING_DIMENSIONS = {
    ("openai", "text-embedding-3-small"): 1536,
    ("openai", "text-embedding-3-large"): 3072,
    ("voyage", "voyage-3"): 1024,
    ("voyage", "voyage-3-large"): 1024,
}


def _api_key_for(provider: str, *, for_chats: bool = False) -> str | None:
    settings = get_settings()
    if for_chats and provider == "groq" and settings.groq_api_key_chats:
        return settings.groq_api_key_chats
    return {
        "anthropic": settings.anthropic_api_key,
        "openai": settings.openai_api_key or settings.omniroute_api_key,
        "groq": settings.groq_api_key,
    }.get(provider)


def _base_url_for(provider: str) -> str | None:
    settings = get_settings()
    if provider == "openai" and settings.chat_base_url:
        return settings.chat_base_url
    return None


@lru_cache
def get_chat_provider() -> ChatProvider:
    """The interactive Ask endpoint's LLM — on its own API key
    (GROQ_API_KEY_CHATS, falling back to GROQ_API_KEY if unset) so it
    doesn't share a rate-limit budget with the summarization/consolidation
    pipeline below."""
    settings = get_settings()
    litellm_model = f"{settings.chat_provider}/{settings.chat_model}"
    return LiteLLMChatProvider(
        model=litellm_model,
        api_key=_api_key_for(settings.chat_provider, for_chats=True),
        base_url=_base_url_for(settings.chat_provider),
    )


@lru_cache
def get_understanding_chat_provider() -> ChatProvider:
    """The per-document summarization / pointer-index consolidation
    pipeline's LLM — see get_chat_provider for why this is a separate key."""
    settings = get_settings()
    litellm_model = f"{settings.chat_provider}/{settings.chat_model}"
    return LiteLLMChatProvider(
        model=litellm_model,
        api_key=_api_key_for(settings.chat_provider),
        base_url=_base_url_for(settings.chat_provider),
    )


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()

    if settings.embedding_provider == "local":
        provider: EmbeddingProvider = LocalEmbeddingProvider(model_name=settings.embedding_model)
    else:
        key = (settings.embedding_provider, settings.embedding_model)
        known_dim = _KNOWN_EMBEDDING_DIMENSIONS.get(key)
        litellm_model = f"{settings.embedding_provider}/{settings.embedding_model}"
        provider = LiteLLMEmbeddingProvider(
            model_name=litellm_model,
            dimension=known_dim or EMBEDDING_DIM,
            api_key=_api_key_for(settings.embedding_provider),
        )

    # Validated regardless of path — boot-time check that refuses to start on
    # a dimension mismatch, forcing the migration runbook in
    # app/providers/embedding.py instead of silent corruption.
    if provider.dimension != EMBEDDING_DIM:
        raise EmbeddingDimensionMismatch(
            f"configured embedding model {settings.embedding_provider}/{settings.embedding_model} "
            f"produces {provider.dimension}-dim vectors, but this deployment's fixed pgvector "
            f"column is {EMBEDDING_DIM}-dim. See app/providers/embedding.py for the migration runbook."
        )
    return provider
