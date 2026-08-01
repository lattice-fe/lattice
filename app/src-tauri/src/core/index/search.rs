use std::path::PathBuf;

use rusqlite::Connection;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchMode {
    /// Match against file names/paths (fastest; the launcher default).
    Name,
    /// Full-text search of file contents (FTS5).
    Text,
    /// Meaning-based search over embeddings.
    Semantic,
}

impl Default for SearchMode {
    fn default() -> Self {
        SearchMode::Name
    }
}

/// One search result, already resolved to a file + a representative snippet.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SearchHit {
    pub file_path: PathBuf,
    pub is_dir: bool,
    pub snippet: String,
    /// Lower is better for FTS (bm25); higher is better for semantic (cosine).
    /// Only used for ordering, which the query already applies.
    pub score: f64,
    pub char_start: i64,
}

/// Turn raw user input into a safe FTS5 MATCH expression: each whitespace token
/// becomes a quoted term (quotes doubled to escape), AND-ed together. Returns
/// `None` for an empty query. This avoids FTS5 syntax errors from user text.
pub fn build_fts_query(input: &str) -> Option<String> {
    let mut terms: Vec<String> = Vec::new();
    for tok in input.split_whitespace() {
        let escaped = tok.replace('"', "\"\"");
        if !escaped.is_empty() {
            terms.push(format!("\"{escaped}\""));
        }
    }
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

/// Run a full-text search and return the best hit per file, ranked by bm25.
pub fn run_text_search(
    conn: &Connection,
    input: &str,
    limit: usize,
) -> rusqlite::Result<Vec<SearchHit>> {
    let Some(match_expr) = build_fts_query(input) else {
        return Ok(Vec::new());
    };

    // Pull more chunk hits than `limit` so we can collapse to one row per file.
    let scan = (limit * 4).max(40);
    let mut stmt = conn.prepare(
        "SELECT f.path,
                snippet(chunk_fts, 0, '[', ']', '…', 12) AS snip,
                bm25(chunk_fts) AS score,
                c.char_start
         FROM chunk_fts
         JOIN chunks c ON c.id = chunk_fts.chunk_id
         JOIN files  f ON f.id = c.file_id
         WHERE chunk_fts MATCH ?1
         ORDER BY score
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(rusqlite::params![match_expr, scan as i64], |r| {
        Ok(SearchHit {
            file_path: PathBuf::from(r.get::<_, String>(0)?),
            is_dir: false,
            snippet: r.get(1)?,
            score: r.get(2)?,
            char_start: r.get(3)?,
        })
    })?;

    // Keep only the first (best-ranked) hit for each file.
    let mut out: Vec<SearchHit> = Vec::new();
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    for hit in rows {
        let hit = hit?;
        if seen.insert(hit.file_path.clone()) {
            out.push(hit);
            if out.len() >= limit {
                break;
            }
        }
    }
    Ok(out)
}

// --- Name-search ranking weights (tuning knobs; see the ranking formula). ---
const W_EXACT_BASE: f64 = 6.0; // basename == query
const W_PREFIX_BASE: f64 = 3.5; // basename starts with query
const W_SUBSTR_BASE: f64 = 1.8; // query is a substring of the basename
const W_EXACT_COMP: f64 = 3.0; // a *parent* path component == query
const W_COMP_SUBSTR: f64 = 0.6; // query is a substring of a parent component
const W_DIR: f64 = 1.2; // directory bonus
const W_RECENCY: f64 = 0.7; // newer items get a small boost
const W_DEPTH: f64 = 0.15; // per-component depth penalty (prefer shallower)
// TODO(usage_frequency): needs an opens-counter table incremented on open.

/// Score one candidate against the (already-lowercased) query terms, using the
/// tokenized path components. Basename and parent-component signals are additive
/// so `src/` (basename==query) outranks a file merely *inside* a `src` folder.
fn name_score(path_str: &str, is_dir: bool, mtime: i64, terms: &[String], min_mtime: i64, max_mtime: i64) -> f64 {
    let comps: Vec<String> = path_str
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .map(|s| s.to_lowercase())
        .collect();
    let name = comps.last().cloned().unwrap_or_default();
    let parents = &comps[..comps.len().saturating_sub(1)];

    let mut score = 0.0;
    for t in terms {
        let base_exact = name == *t;
        if base_exact {
            score += W_EXACT_BASE;
        } else if name.starts_with(t.as_str()) {
            score += W_PREFIX_BASE + W_SUBSTR_BASE * (t.len() as f64 / name.len().max(1) as f64);
        } else if name.contains(t.as_str()) {
            score += W_SUBSTR_BASE * (t.len() as f64 / name.len().max(1) as f64);
        }
        // Parent-component match only matters when the basename isn't the exact hit.
        if !base_exact {
            if parents.iter().any(|c| c == t) {
                score += W_EXACT_COMP;
            } else if parents.iter().any(|c| c.contains(t.as_str())) {
                score += W_COMP_SUBSTR;
            }
        }
    }
    if is_dir {
        score += W_DIR;
    }
    if max_mtime > min_mtime {
        score += W_RECENCY * ((mtime - min_mtime) as f64 / (max_mtime - min_mtime) as f64);
    }
    score - W_DEPTH * comps.len() as f64
}

/// Match files/folders by name/path and rank with a weighted, tokenized score
/// (exact basename ≫ exact parent component ≫ substring; folders and recency
/// nudged up; shallower paths win ties).
pub fn run_name_search(
    conn: &Connection,
    input: &str,
    limit: usize,
) -> rusqlite::Result<Vec<SearchHit>> {
    let terms: Vec<String> = input.split_whitespace().map(|t| t.to_lowercase()).collect();
    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let where_clause = terms
        .iter()
        .map(|_| "lower(path) LIKE ?")
        .collect::<Vec<_>>()
        .join(" AND ");
    // Over-fetch a candidate pool (dirs + shorter paths first) then rank precisely.
    let sql = format!(
        "SELECT DISTINCT path, is_dir, mtime FROM files WHERE {where_clause} \
         ORDER BY is_dir DESC, length(path) ASC LIMIT 1000"
    );
    let like_params: Vec<String> = terms.iter().map(|t| format!("%{t}%")).collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(like_params.iter()), |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0, r.get::<_, i64>(2)?))
    })?;
    let cands: Vec<(String, bool, i64)> = rows.collect::<Result<_, _>>()?;

    let min_mtime = cands.iter().map(|c| c.2).min().unwrap_or(0);
    let max_mtime = cands.iter().map(|c| c.2).max().unwrap_or(0);

    let mut scored: Vec<(f64, String, bool)> = cands
        .into_iter()
        .map(|(path, is_dir, mtime)| {
            (name_score(&path, is_dir, mtime, &terms, min_mtime, max_mtime), path, is_dir)
        })
        .collect();
    // Highest score first; shorter path breaks ties.
    scored.sort_by(|a, b| {
        b.0.partial_cmp(&a.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.1.len().cmp(&b.1.len()))
    });

    Ok(scored
        .into_iter()
        .take(limit)
        .map(|(score, path, is_dir)| SearchHit {
            file_path: PathBuf::from(path),
            is_dir,
            snippet: String::new(),
            score,
            char_start: 0,
        })
        .collect())
}

/// Run a semantic (vector KNN) search using an already-embedded query vector,
/// returning the best hit per file. `distance` is L2 (lower = more similar).
pub fn run_semantic_search(
    conn: &Connection,
    query_vec: &[f32],
    limit: usize,
) -> rusqlite::Result<Vec<SearchHit>> {
    // Guard: sqlite-vec can hard-crash (native abort) on a mismatched vector
    // length, so refuse anything that isn't exactly EMBED_DIM.
    if query_vec.len() != crate::core::index::db::EMBED_DIM {
        return Ok(Vec::new());
    }
    let scan = (limit * 4).max(40);
    let blob = crate::core::index::db::vec_to_blob(query_vec);

    // Do the KNN in a subquery with LIMIT (the portable vec0 form), then join
    // out to file metadata.
    let mut stmt = conn.prepare(
        "SELECT v.rowid, v.distance, f.path, c.char_start
         FROM (
             SELECT rowid, distance
             FROM vec_chunks
             WHERE embedding MATCH ?1
             ORDER BY distance
             LIMIT ?2
         ) v
         JOIN chunks c ON c.id = v.rowid
         JOIN files  f ON f.id = c.file_id
         ORDER BY v.distance",
    )?;

    let rows = stmt.query_map(rusqlite::params![blob, scan as i64], |r| {
        Ok((
            r.get::<_, i64>(0)?,          // chunk_id
            r.get::<_, f64>(1)?,          // distance
            PathBuf::from(r.get::<_, String>(2)?),
            r.get::<_, i64>(3)?,          // char_start
        ))
    })?;

    let mut out: Vec<SearchHit> = Vec::new();
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    for row in rows {
        let (chunk_id, distance, path, char_start) = row?;
        if !seen.insert(path.clone()) {
            continue;
        }
        let snippet = crate::core::index::db::chunk_text(conn, chunk_id)
            .ok()
            .flatten()
            .unwrap_or_default();
        out.push(SearchHit {
            file_path: path,
            is_dir: false,
            snippet,
            score: distance,
            char_start,
        });
        if out.len() >= limit {
            break;
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::index::db;

    #[test]
    fn name_ranking_prefers_basename_and_shallow_dirs() {
        let conn = db::open_in_memory().unwrap();
        let cid = db::insert_collection(&conn, "D:/dev").unwrap();
        let add = |path: &str, is_dir: bool| {
            db::upsert_file(&conn, cid, path, 0, 0, 0, is_dir).unwrap();
        };
        add("D:/dev/aegis", true);
        add("D:/dev/aegis/app/src", true);
        add("D:/dev/aegis/app/src/main/java/com/example/aegis", true);
        add("D:/dev/aegis/app/src/main/java/com/example/aegis/AegisApplication.kt", false);
        add("D:/dev/other/src/deep/nested/thing.txt", false);

        // "src": the src *folders* must outrank files merely inside a src path.
        let hits = run_name_search(&conn, "src", 10).unwrap();
        assert!(hits[0].is_dir, "top src hit should be a directory, got {:?}", hits[0].file_path);
        assert_eq!(hits[0].file_path, PathBuf::from("D:/dev/aegis/app/src"), "shallow src dir first");

        // "aegis": the shallow D:/dev/aegis dir should beat the deeper same-named dir.
        let hits = run_name_search(&conn, "aegis", 10).unwrap();
        assert_eq!(hits[0].file_path, PathBuf::from("D:/dev/aegis"), "shallow aegis dir first, got {:?}", hits[0].file_path);
    }

    #[test]
    fn build_query_quotes_and_ands_tokens() {
        assert_eq!(build_fts_query("foo bar"), Some("\"foo\" \"bar\"".into()));
        assert_eq!(build_fts_query("   "), None);
        assert_eq!(build_fts_query(""), None);
        // Quotes are escaped, and FTS operators are neutralized by quoting.
        assert_eq!(build_fts_query("a\"b"), Some("\"a\"\"b\"".into()));
        assert_eq!(build_fts_query("NEAR(x"), Some("\"NEAR(x\"".into()));
    }

    fn embed_dim_vec(a: f32, b: f32, c: f32) -> Vec<f32> {
        let mut v = vec![0.0f32; crate::core::index::db::EMBED_DIM];
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v
    }

    #[test]
    fn semantic_search_runs_and_ranks() {
        let conn = crate::core::index::db::open_in_memory().unwrap();
        conn.execute("INSERT INTO collections(root) VALUES ('C:/tmp')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO files(collection_id, path, mtime, size) VALUES (1, 'C:/tmp/a.txt', 0, 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(collection_id, path, mtime, size) VALUES (1, 'C:/tmp/b.txt', 0, 0)",
            [],
        )
        .unwrap();

        // Two chunks/files with distinct directions.
        let c1 = crate::core::index::db::insert_chunk(&conn, 1, 0, 0, 5, "alpha text").unwrap();
        let c2 = crate::core::index::db::insert_chunk(&conn, 2, 0, 0, 5, "beta text").unwrap();
        crate::core::index::db::insert_embedding(&conn, c1, &embed_dim_vec(1.0, 0.0, 0.0)).unwrap();
        crate::core::index::db::insert_embedding(&conn, c2, &embed_dim_vec(0.0, 1.0, 0.0)).unwrap();

        let query = embed_dim_vec(0.9, 0.1, 0.0);
        let hits = run_semantic_search(&conn, &query, 10).unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits[0].file_path.to_string_lossy().ends_with("a.txt"));
        assert_eq!(hits[0].snippet, "alpha text");
    }

    #[test]
    fn text_search_finds_and_dedupes_by_file() {
        let conn = crate::core::index::db::open_in_memory().unwrap();
        conn.execute("INSERT INTO collections(root) VALUES ('C:/tmp')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO files(collection_id, path, mtime, size) VALUES (1, 'C:/tmp/a.txt', 0, 0)",
            [],
        )
        .unwrap();
        // Two chunks in the same file both matching "carrot".
        for (ord, s, e, text) in [
            (0, 0, 20, "carrot cake recipe"),
            (1, 20, 40, "more carrot notes"),
        ] {
            crate::core::index::db::insert_chunk(&conn, 1, ord, s, e, text).unwrap();
        }
        // A different file matching too.
        conn.execute(
            "INSERT INTO files(collection_id, path, mtime, size) VALUES (1, 'C:/tmp/b.md', 0, 0)",
            [],
        )
        .unwrap();
        crate::core::index::db::insert_chunk(&conn, 2, 0, 0, 10, "carrot soup").unwrap();

        let hits = run_text_search(&conn, "carrot", 10).unwrap();
        // One row per file (a.txt collapsed), both files present.
        assert_eq!(hits.len(), 2);
        let paths: Vec<_> = hits.iter().map(|h| h.file_path.to_string_lossy().into_owned()).collect();
        assert!(paths.iter().any(|p| p.ends_with("a.txt")));
        assert!(paths.iter().any(|p| p.ends_with("b.md")));

        assert!(run_text_search(&conn, "nonexistentword", 10).unwrap().is_empty());
    }
}
