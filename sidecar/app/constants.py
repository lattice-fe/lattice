# Coarse per-document classification, generated alongside the summary/
# one-liner in app/pipeline/stages/summarize.py. Drives the category badge in
# the "Contents at a glance" overview list — keep in sync with
# web/src/lib/format.ts's CATEGORY_META if this changes.
CATEGORY_TAXONOMY = ("spec", "research", "decision", "incident", "notes", "data")

# Fixed pgvector column dimension for chunk_embeddings.embedding.
# MVP supports one active embedding dimension system-wide. Changing this value
# requires the migration runbook documented in app/providers/embedding.py —
# it is not a config flip, since pgvector columns are fixed-dimension and
# existing vectors would silently mismatch a new model's output size.
# Currently 384 to match the local sentence-transformers/all-MiniLM-L6-v2
# default (no embedding API key required); switch to 1536 if/when moving to
# openai/text-embedding-3-small, via the runbook, not by editing this alone.
EMBEDDING_DIM = 384
