from abc import ABC, abstractmethod

# --- Embedding dimension / provider-swap migration runbook -----------------
# pgvector columns are fixed-dimension (app.constants.EMBEDDING_DIM), and
# different providers/models produce different-sized vectors. Switching the
# active embedding model on a live system is therefore NOT a config flip.
# Runbook when a new model's dimension differs from EMBEDDING_DIM:
#   1. Add a new row to embedding_models for the target (provider, model_name,
#      dimension).
#   2. Alembic migration adds a new dimension-sized chunk_embeddings table (or
#      column) alongside the existing one.
#   3. A background job re-embeds all chunks into the new table via the new
#      EmbeddingProvider, while the old table stays live and queryable.
#   4. Flip scopes.embedding_model_id per scope once verified.
#   5. Drop the old vector data after a grace period.
# Boot-time validation (see get_default_embedding_provider) refuses to start
# if the configured model's dimension doesn't match EMBEDDING_DIM, forcing
# this deliberate migration instead of silent corruption.
# -----------------------------------------------------------------------------


class EmbeddingDimensionMismatch(Exception):
    pass


class EmbeddingProvider(ABC):
    model_name: str
    dimension: int

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class LiteLLMEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model_name: str, dimension: int, api_key: str | None = None, batch_size: int = 96):
        self.model_name = model_name
        self.dimension = dimension
        self.api_key = api_key
        self.batch_size = batch_size

    def embed(self, texts: list[str]) -> list[list[float]]:
        import litellm

        vectors: list[list[float]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            response = litellm.embedding(model=self.model_name, input=batch, api_key=self.api_key)
            vectors.extend(item["embedding"] for item in response.data)
        return vectors


class LocalEmbeddingProvider(EmbeddingProvider):
    """Runs a sentence-transformers model locally (CPU) — no API key needed.
    Model loads once per process; get_embedding_provider() is lru_cache'd so
    that happens exactly once per worker/app process, not per request."""

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name
        self._model = SentenceTransformer(model_name)
        self.dimension = self._model.get_sentence_embedding_dimension()

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return vectors.tolist()
