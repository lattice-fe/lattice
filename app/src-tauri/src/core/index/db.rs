use std::path::{Path, PathBuf};
use std::sync::Once;

use rusqlite::Connection;

/// Embedding dimensionality (all-MiniLM-L6-v2 / bge-small).
pub const EMBED_DIM: usize = 384;

/// Directory holding the index database (`%LOCALAPPDATA%\Lattice`).
pub fn data_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Lattice")
}

/// Default on-disk location of the index database.
pub fn default_db_path() -> PathBuf {
    data_dir().join("index.db")
}

/// Register the sqlite-vec extension as an auto-extension so every connection
/// opened afterwards has the `vec0` virtual table available. Safe to call more
/// than once; only the first call takes effect.
fn register_sqlite_vec() {
    static REGISTER: Once = Once::new();
    REGISTER.call_once(|| unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    });
}

/// Open (creating if needed) the index database at `path`, apply pragmas, load
/// sqlite-vec, and run migrations.
pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    register_sqlite_vec();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;
    migrate(&conn)?;
    Ok(conn)
}

/// Open an in-memory database (used by tests).
#[cfg(test)]
pub fn open_in_memory() -> rusqlite::Result<Connection> {
    register_sqlite_vec();
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(&format!(
        "CREATE TABLE IF NOT EXISTS collections (
            id           INTEGER PRIMARY KEY,
            root         TEXT NOT NULL UNIQUE,
            semantic     INTEGER NOT NULL DEFAULT 0,
            status       TEXT NOT NULL DEFAULT 'idle',
            last_indexed INTEGER
        );

        CREATE TABLE IF NOT EXISTS files (
            id            INTEGER PRIMARY KEY,
            collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            path          TEXT NOT NULL,
            mtime         INTEGER NOT NULL,
            size          INTEGER NOT NULL,
            indexed_at    INTEGER,
            is_dir        INTEGER NOT NULL DEFAULT 0,
            UNIQUE(collection_id, path)
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id         INTEGER PRIMARY KEY,
            file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            ordinal    INTEGER NOT NULL,
            char_start INTEGER NOT NULL,
            char_end   INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(text, chunk_id UNINDEXED);

        CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[{EMBED_DIM}]);",
    ))?;
    // Migrate existing DBs (created before directories were indexed).
    let _ = conn.execute("ALTER TABLE files ADD COLUMN is_dir INTEGER NOT NULL DEFAULT 0", []);
    Ok(())
}

/// Pack a float vector into the little-endian byte blob sqlite-vec expects.
pub fn vec_to_blob(v: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(v.len() * 4);
    for x in v {
        out.extend_from_slice(&x.to_le_bytes());
    }
    out
}

/// Summary of an indexed collection for the UI.
#[derive(Debug, Clone, serde::Serialize)]
pub struct CollectionInfo {
    pub id: i64,
    pub root: PathBuf,
    pub semantic: bool,
    pub status: String,
    pub file_count: i64,
}

/// Insert a collection root (idempotent) and return its id.
pub fn insert_collection(conn: &Connection, root: &str) -> rusqlite::Result<i64> {
    conn.execute("INSERT OR IGNORE INTO collections(root) VALUES (?1)", [root])?;
    conn.query_row("SELECT id FROM collections WHERE root = ?1", [root], |r| r.get(0))
}

pub fn set_collection_status(conn: &Connection, id: i64, status: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE collections SET status = ?2 WHERE id = ?1",
        rusqlite::params![id, status],
    )?;
    Ok(())
}

pub fn set_collection_semantic(conn: &Connection, id: i64, on: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE collections SET semantic = ?2 WHERE id = ?1",
        rusqlite::params![id, on as i64],
    )?;
    Ok(())
}

pub fn mark_indexed(conn: &Connection, id: i64, when: i64) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE collections SET last_indexed = ?2, status = 'ready' WHERE id = ?1",
        rusqlite::params![id, when],
    )?;
    Ok(())
}

/// List all collections with their file counts.
pub fn list_collections(conn: &Connection) -> rusqlite::Result<Vec<CollectionInfo>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.root, c.semantic, c.status,
                (SELECT COUNT(*) FROM files f WHERE f.collection_id = c.id)
         FROM collections c ORDER BY c.root",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(CollectionInfo {
            id: r.get(0)?,
            root: PathBuf::from(r.get::<_, String>(1)?),
            semantic: r.get::<_, i64>(2)? != 0,
            status: r.get(3)?,
            file_count: r.get(4)?,
        })
    })?;
    rows.collect()
}

/// Remove a collection and all of its indexed data, including the virtual-table
/// rows (FTS5/vec0 aren't covered by foreign-key cascade, so clean them first).
pub fn delete_collection(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    // `chunk_fts.chunk_id` is UNINDEXED, so deleting per-chunk is a full FTS scan
    // each time (O(n²) — hangs for big collections). One subquery delete scans
    // each virtual table once.
    let sub = "SELECT c.id FROM chunks c JOIN files f ON f.id = c.file_id WHERE f.collection_id = ?1";
    let tx = conn.unchecked_transaction()?;
    tx.execute(&format!("DELETE FROM chunk_fts WHERE chunk_id IN ({sub})"), [id])?;
    tx.execute(&format!("DELETE FROM vec_chunks WHERE rowid IN ({sub})"), [id])?;
    tx.execute("DELETE FROM collections WHERE id = ?1", [id])?; // cascades files + chunks
    tx.commit()
}

/// Whether a collection has semantic (embedding) indexing enabled.
pub fn collection_semantic(conn: &Connection, id: i64) -> rusqlite::Result<bool> {
    conn.query_row("SELECT semantic FROM collections WHERE id = ?1", [id], |r| {
        Ok(r.get::<_, i64>(0)? != 0)
    })
}

/// Remove all embedding vectors for a collection (keeps FTS/chunks intact).
pub fn delete_collection_embeddings(conn: &Connection, collection_id: i64) -> rusqlite::Result<()> {
    let ids = collection_chunk_ids(conn, collection_id)?;
    for id in ids {
        conn.execute("DELETE FROM vec_chunks WHERE rowid = ?1", [id])?;
    }
    Ok(())
}

/// All (chunk_id, text) pairs for a collection, read from the FTS store.
pub fn collection_chunk_texts(
    conn: &Connection,
    collection_id: i64,
) -> rusqlite::Result<Vec<(i64, String)>> {
    let mut stmt = conn.prepare(
        "SELECT cf.chunk_id, cf.text
         FROM chunk_fts cf
         JOIN chunks c ON c.id = cf.chunk_id
         JOIN files  f ON f.id = c.file_id
         WHERE f.collection_id = ?1",
    )?;
    let rows = stmt.query_map([collection_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

/// Fetch a single chunk's text (for showing a semantic result's snippet).
pub fn chunk_text(conn: &Connection, chunk_id: i64) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT text FROM chunk_fts WHERE chunk_id = ?1",
        [chunk_id],
        |r| r.get(0),
    )
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

fn collection_chunk_ids(conn: &Connection, collection_id: i64) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT c.id FROM chunks c JOIN files f ON f.id = c.file_id WHERE f.collection_id = ?1",
    )?;
    let ids = stmt.query_map([collection_id], |r| r.get(0))?;
    ids.collect()
}

/// List all (file_id, path) pairs recorded for a collection.
pub fn collection_files(conn: &Connection, collection_id: i64) -> rusqlite::Result<Vec<(i64, String)>> {
    let mut stmt = conn.prepare("SELECT id, path FROM files WHERE collection_id = ?1")?;
    let rows = stmt.query_map([collection_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

/// Look up a file row's (id, mtime, size) within a collection, if present.
pub fn file_row(
    conn: &Connection,
    collection_id: i64,
    path: &str,
) -> rusqlite::Result<Option<(i64, i64, i64)>> {
    conn.query_row(
        "SELECT id, mtime, size FROM files WHERE collection_id = ?1 AND path = ?2",
        rusqlite::params![collection_id, path],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

/// Insert or update a file row, returning its id.
pub fn upsert_file(
    conn: &Connection,
    collection_id: i64,
    path: &str,
    mtime: i64,
    size: i64,
    now: i64,
    is_dir: bool,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO files(collection_id, path, mtime, size, indexed_at, is_dir)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(collection_id, path)
         DO UPDATE SET mtime = ?3, size = ?4, indexed_at = ?5, is_dir = ?6",
        rusqlite::params![collection_id, path, mtime, size, now, is_dir as i64],
    )?;
    conn.query_row(
        "SELECT id FROM files WHERE collection_id = ?1 AND path = ?2",
        rusqlite::params![collection_id, path],
        |r| r.get(0),
    )
}

/// Delete a file row and every trace of its chunks (real + virtual tables).
pub fn delete_file(conn: &Connection, file_id: i64) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("SELECT id FROM chunks WHERE file_id = ?1")?;
    let chunk_ids: Vec<i64> = stmt.query_map([file_id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    delete_chunk_index_rows(conn, &chunk_ids)?;
    conn.execute("DELETE FROM files WHERE id = ?1", [file_id])?; // cascades chunks
    Ok(())
}

/// Clear a file's chunks (keeping the file row) so it can be re-chunked.
pub fn clear_file_chunks(conn: &Connection, file_id: i64) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("SELECT id FROM chunks WHERE file_id = ?1")?;
    let chunk_ids: Vec<i64> = stmt.query_map([file_id], |r| r.get(0))?.collect::<Result<_, _>>()?;
    delete_chunk_index_rows(conn, &chunk_ids)?;
    conn.execute("DELETE FROM chunks WHERE file_id = ?1", [file_id])?;
    Ok(())
}

fn delete_chunk_index_rows(conn: &Connection, chunk_ids: &[i64]) -> rusqlite::Result<()> {
    if chunk_ids.is_empty() {
        return Ok(());
    }
    // One IN-list delete per virtual table (single scan). Per-chunk deletes scan
    // the whole FTS each time (chunk_id is UNINDEXED) — O(n²). Chunk lists here are
    // per-file (small), well under SQLite's parameter limit.
    let tx = conn.unchecked_transaction()?;
    for batch in chunk_ids.chunks(512) {
        let placeholders = batch.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let params: Vec<&dyn rusqlite::ToSql> = batch.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
        tx.execute(&format!("DELETE FROM chunk_fts WHERE chunk_id IN ({placeholders})"), params.as_slice())?;
        tx.execute(&format!("DELETE FROM vec_chunks WHERE rowid IN ({placeholders})"), params.as_slice())?;
    }
    tx.commit()
}

/// Insert one chunk (metadata + FTS text) and return its id.
pub fn insert_chunk(
    conn: &Connection,
    file_id: i64,
    ordinal: i64,
    char_start: i64,
    char_end: i64,
    text: &str,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO chunks(file_id, ordinal, char_start, char_end) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![file_id, ordinal, char_start, char_end],
    )?;
    let chunk_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO chunk_fts(text, chunk_id) VALUES (?1, ?2)",
        rusqlite::params![text, chunk_id],
    )?;
    Ok(chunk_id)
}

/// Insert a chunk's embedding vector into the vec0 table.
pub fn insert_embedding(conn: &Connection, chunk_id: i64, vector: &[f32]) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO vec_chunks(rowid, embedding) VALUES (?1, ?2)",
        rusqlite::params![chunk_id, vec_to_blob(vector)],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn delete_collection_scale() {
        use std::time::Instant;
        let conn = open_in_memory().unwrap();
        let cid = insert_collection(&conn, "C:/big").unwrap();
        let files = 5000i64;
        let chunks_per = 10i64; // 50k chunks
        let emb = vec![0.05f32; EMBED_DIM];
        let semantic = std::env::var("SCALE_SEMANTIC").is_ok(); // off by default (matches D:)

        let t0 = Instant::now();
        for f in 0..files {
            let fid = upsert_file(&conn, cid, &format!("C:/big/f{f}.txt"), 0, 0, 0, false).unwrap();
            for c in 0..chunks_per {
                let ch = insert_chunk(&conn, fid, c, 0, 5, "hello world sample text here").unwrap();
                if semantic { insert_embedding(&conn, ch, &emb).unwrap(); }
            }
        }
        let n: i64 = conn.query_row("SELECT count(*) FROM chunks", [], |r| r.get(0)).unwrap();
        eprintln!("[scale] setup {n} chunks in {:?}", t0.elapsed());

        // The real path the worker takes.
        let t1 = Instant::now();
        delete_collection(&conn, cid).unwrap();
        let elapsed = t1.elapsed();
        eprintln!("[scale] delete_collection in {:?}", elapsed);

        let left: i64 = conn.query_row("SELECT count(*) FROM chunks", [], |r| r.get(0)).unwrap();
        let fts: i64 = conn.query_row("SELECT count(*) FROM chunk_fts", [], |r| r.get(0)).unwrap();
        assert_eq!(left, 0, "chunks not deleted");
        assert_eq!(fts, 0, "fts rows not deleted");
        assert!(elapsed.as_secs() < 30, "delete_collection too slow: {elapsed:?}");
    }

    #[test]
    fn schema_applies_and_sqlite_vec_loads() {
        // This is the critical smoke test: if vec0 didn't load, creating the
        // virtual table in migrate() would already have failed.
        let conn = open_in_memory().unwrap();
        let vec_version: String = conn
            .query_row("SELECT vec_version()", [], |r| r.get(0))
            .expect("sqlite-vec vec_version() should be callable");
        assert!(vec_version.starts_with('v'), "got {vec_version}");
    }

    #[test]
    fn fts_matches_inserted_chunk() {
        let conn = open_in_memory().unwrap();
        conn.execute("INSERT INTO collections(root) VALUES ('C:/tmp')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO files(collection_id, path, mtime, size) VALUES (1, 'a.txt', 0, 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chunks(file_id, ordinal, char_start, char_end) VALUES (1, 0, 0, 20)",
            [],
        )
        .unwrap();
        let chunk_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO chunk_fts(text, chunk_id) VALUES (?, ?)",
            params!["the quick brown fox", chunk_id],
        )
        .unwrap();

        let hit: i64 = conn
            .query_row(
                "SELECT chunk_id FROM chunk_fts WHERE chunk_fts MATCH ?",
                params!["brown"],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hit, chunk_id);
    }

    #[test]
    fn vec_knn_returns_nearest() {
        let conn = open_in_memory().unwrap();

        // Three 3-d style vectors padded to EMBED_DIM; nearest to the query
        // should be the one pointing the same direction.
        let mk = |a: f32, b: f32, c: f32| {
            let mut v = vec![0.0f32; EMBED_DIM];
            v[0] = a;
            v[1] = b;
            v[2] = c;
            v
        };
        let rows = [(1i64, mk(1.0, 0.0, 0.0)), (2, mk(0.0, 1.0, 0.0)), (3, mk(0.0, 0.0, 1.0))];
        for (id, v) in &rows {
            conn.execute(
                "INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)",
                params![id, vec_to_blob(v)],
            )
            .unwrap();
        }

        let query = mk(0.9, 0.1, 0.0);
        let nearest: i64 = conn
            .query_row(
                "SELECT rowid FROM vec_chunks WHERE embedding MATCH ? ORDER BY distance LIMIT 1",
                params![vec_to_blob(&query)],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(nearest, 1);
    }
}
