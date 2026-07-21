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
#[derive(Debug, Clone)]
pub struct SearchHit {
    pub file_path: PathBuf,
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

/// Match files by name/path (case-insensitive substring, all terms). Files
/// whose *name* matches rank above those matching only in the directory path.
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
    let sql = format!(
        "SELECT DISTINCT path FROM files WHERE {where_clause} LIMIT {}",
        limit * 4
    );
    let like_params: Vec<String> = terms.iter().map(|t| format!("%{t}%")).collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(like_params.iter()), |r| {
        Ok(PathBuf::from(r.get::<_, String>(0)?))
    })?;
    let mut paths: Vec<PathBuf> = rows.collect::<Result<_, _>>()?;

    // Rank filename matches first.
    paths.sort_by_cached_key(|p| {
        let name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let in_name = terms.iter().all(|t| name.contains(t));
        (u8::from(!in_name), name)
    });

    Ok(paths
        .into_iter()
        .take(limit)
        .map(|p| SearchHit {
            file_path: p,
            snippet: String::new(),
            score: 0.0,
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
    if query_vec.len() != crate::index::db::EMBED_DIM {
        return Ok(Vec::new());
    }
    let scan = (limit * 4).max(40);
    let blob = crate::index::db::vec_to_blob(query_vec);

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
        let snippet = crate::index::db::chunk_text(conn, chunk_id)
            .ok()
            .flatten()
            .unwrap_or_default();
        out.push(SearchHit {
            file_path: path,
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
        let mut v = vec![0.0f32; crate::index::db::EMBED_DIM];
        v[0] = a;
        v[1] = b;
        v[2] = c;
        v
    }

    #[test]
    fn semantic_search_runs_and_ranks() {
        let conn = crate::index::db::open_in_memory().unwrap();
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
        let c1 = crate::index::db::insert_chunk(&conn, 1, 0, 0, 5, "alpha text").unwrap();
        let c2 = crate::index::db::insert_chunk(&conn, 2, 0, 0, 5, "beta text").unwrap();
        crate::index::db::insert_embedding(&conn, c1, &embed_dim_vec(1.0, 0.0, 0.0)).unwrap();
        crate::index::db::insert_embedding(&conn, c2, &embed_dim_vec(0.0, 1.0, 0.0)).unwrap();

        let query = embed_dim_vec(0.9, 0.1, 0.0);
        let hits = run_semantic_search(&conn, &query, 10).unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits[0].file_path.to_string_lossy().ends_with("a.txt"));
        assert_eq!(hits[0].snippet, "alpha text");
    }

    #[test]
    fn text_search_finds_and_dedupes_by_file() {
        let conn = crate::index::db::open_in_memory().unwrap();
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
            crate::index::db::insert_chunk(&conn, 1, ord, s, e, text).unwrap();
        }
        // A different file matching too.
        conn.execute(
            "INSERT INTO files(collection_id, path, mtime, size) VALUES (1, 'C:/tmp/b.md', 0, 0)",
            [],
        )
        .unwrap();
        crate::index::db::insert_chunk(&conn, 2, 0, 0, 10, "carrot soup").unwrap();

        let hits = run_text_search(&conn, "carrot", 10).unwrap();
        // One row per file (a.txt collapsed), both files present.
        assert_eq!(hits.len(), 2);
        let paths: Vec<_> = hits.iter().map(|h| h.file_path.to_string_lossy().into_owned()).collect();
        assert!(paths.iter().any(|p| p.ends_with("a.txt")));
        assert!(paths.iter().any(|p| p.ends_with("b.md")));

        assert!(run_text_search(&conn, "nonexistentword", 10).unwrap().is_empty());
    }
}
