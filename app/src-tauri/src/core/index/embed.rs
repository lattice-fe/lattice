use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};

use super::db::EMBED_DIM;

/// Wraps a local sentence-transformer (all-MiniLM-L6-v2, 384-dim) via fastembed
/// / ONNX Runtime. Constructing it downloads the model on first use.
pub struct Embedder {
    model: TextEmbedding,
}

impl Embedder {
    pub fn new() -> Result<Self, String> {
        let model = TextEmbedding::try_new(TextInitOptions::new(EmbeddingModel::AllMiniLML6V2))
            .map_err(|e| format!("load embedding model: {e}"))?;
        Ok(Embedder { model })
    }

    /// Embed a batch of texts, L2-normalized so vec0's L2 distance ranks like
    /// cosine similarity.
    pub fn embed_batch(&mut self, texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }
        let mut out = self
            .model
            .embed(texts, None)
            .map_err(|e| format!("embed: {e}"))?;
        for v in &mut out {
            if v.len() != EMBED_DIM {
                return Err(format!(
                    "unexpected embedding dimension {} (want {EMBED_DIM})",
                    v.len()
                ));
            }
            normalize(v);
        }
        Ok(out)
    }

    /// Embed a single query string.
    pub fn embed_query(&mut self, text: &str) -> Result<Vec<f32>, String> {
        let mut out = self.embed_batch(vec![text.to_string()])?;
        out.pop().ok_or_else(|| "empty embedding result".to_string())
    }
}

fn normalize(v: &mut [f32]) {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}
