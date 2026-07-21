use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::mpsc::Receiver;

use iced::futures::channel::mpsc::Sender as OutSender;
use iced::futures::{SinkExt, Stream};
use rusqlite::Connection;
use tokio::sync::mpsc::Sender as EventSender;

use super::db::{self, CollectionInfo};
use super::embed::Embedder;
use super::search::{self, SearchHit, SearchMode};
use super::{chunk, extract, walk};
use crate::message::Message;

/// Commands the UI sends to the indexer worker.
#[derive(Debug)]
pub enum Command {
    AddCollection(PathBuf),
    Reindex(i64),
    RemoveCollection(i64),
    SetSemantic(i64, bool),
    Search {
        seq: u64,
        query: String,
        mode: SearchMode,
    },
}

/// Events the worker sends back to the UI.
#[derive(Debug, Clone)]
pub enum Event {
    Collections(Vec<CollectionInfo>),
    Progress {
        collection: i64,
        done: usize,
        total: usize,
        current: String,
    },
    Indexed(i64),
    Results {
        seq: u64,
        hits: Vec<SearchHit>,
    },
    /// Transient status line (model loading, embedding progress). `None` clears.
    Status(Option<String>),
    Error(String),
}

const BATCH: usize = 20;
const EMBED_BATCH: usize = 64;
const SEARCH_LIMIT: usize = 60;

/// The iced subscription: spawns the worker thread and streams its events as
/// `Message`s, first handing the UI a `Sender<Command>` via `IndexerReady`.
pub fn connect() -> impl Stream<Item = Message> {
    iced::stream::channel(256, |mut output: OutSender<Message>| async move {
        let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<Command>();
        let (ev_tx, mut ev_rx) = tokio::sync::mpsc::channel::<Event>(512);

        std::thread::spawn(move || Worker::run(cmd_rx, ev_tx));

        let _ = output.send(Message::IndexerReady(cmd_tx)).await;

        while let Some(event) = ev_rx.recv().await {
            if output.send(Message::Indexer(event)).await.is_err() {
                break;
            }
        }
    })
}

/// Owns the DB write connection and (lazily) the embedding model for its whole
/// lifetime; both are single-threaded types that never leave this thread.
struct Worker {
    conn: Connection,
    embedder: Option<Embedder>,
    ev: EventSender<Event>,
}

impl Worker {
    fn run(cmd_rx: Receiver<Command>, ev_tx: EventSender<Event>) {
        let conn = match db::open(&db::default_db_path()) {
            Ok(c) => c,
            Err(e) => {
                let _ = ev_tx.blocking_send(Event::Error(format!("open index db: {e}")));
                return;
            }
        };
        let mut worker = Worker {
            conn,
            embedder: None,
            ev: ev_tx,
        };
        worker.emit_collections();

        let mut queue: VecDeque<Command> = VecDeque::new();
        loop {
            let cmd = match queue.pop_front() {
                Some(c) => c,
                None => match cmd_rx.recv() {
                    Ok(c) => c,
                    Err(_) => break, // UI gone
                },
            };
            // Recover from any panic in a handler so the worker keeps serving.
            let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                worker.handle(&cmd_rx, &mut queue, cmd)
            }));
            if outcome.is_err() {
                worker.emit_error("indexer recovered from an internal error".to_string());
            }
        }
    }

    fn handle(&mut self, cmd_rx: &Receiver<Command>, queue: &mut VecDeque<Command>, cmd: Command) {
        eprintln!("[worker] recv {cmd:?}");
        match cmd {
            Command::Search { seq, query, mode } => self.do_search(seq, query, mode),
            Command::AddCollection(root) => {
                let root_str = root.to_string_lossy().into_owned();
                match db::insert_collection(&self.conn, &root_str) {
                    Ok(id) => {
                        self.emit_collections();
                        self.index_collection(cmd_rx, queue, id, &root);
                    }
                    Err(e) => self.emit_error(format!("add collection: {e}")),
                }
            }
            Command::Reindex(id) => {
                if let Ok(Some(root)) = self.collection_root(id) {
                    self.index_collection(cmd_rx, queue, id, &root);
                }
            }
            Command::RemoveCollection(id) => {
                match db::delete_collection(&self.conn, id) {
                    Ok(()) => eprintln!("[worker] removed collection {id}"),
                    Err(e) => {
                        eprintln!("[worker] remove collection {id} FAILED: {e}");
                        self.emit_error(format!("remove collection: {e}"));
                    }
                }
                self.emit_collections();
            }
            Command::SetSemantic(id, on) => {
                eprintln!("[worker] set_semantic({id}, {on}) starting");
                self.set_semantic(cmd_rx, queue, id, on);
                eprintln!("[worker] set_semantic({id}, {on}) done");
            }
        }
    }

    fn index_collection(
        &mut self,
        cmd_rx: &Receiver<Command>,
        queue: &mut VecDeque<Command>,
        collection_id: i64,
        root: &PathBuf,
    ) {
        let semantic = db::collection_semantic(&self.conn, collection_id).unwrap_or(false);
        let _ = db::set_collection_status(&self.conn, collection_id, "indexing");
        let found = walk::discover(root);
        let total = found.len();

        // Prune files that have disappeared since the last index.
        let found_paths: std::collections::HashSet<String> = found
            .iter()
            .map(|f| f.path.to_string_lossy().into_owned())
            .collect();
        if let Ok(existing) = db::collection_files(&self.conn, collection_id) {
            for (file_id, path) in existing {
                if !found_paths.contains(&path) {
                    let _ = db::delete_file(&self.conn, file_id);
                }
            }
        }

        for (i, file) in found.iter().enumerate() {
            let path_str = file.path.to_string_lossy().into_owned();
            let unchanged = matches!(
                db::file_row(&self.conn, collection_id, &path_str),
                Ok(Some((_, mtime, size))) if mtime == file.mtime && size == file.size as i64
            );
            if !unchanged {
                let _ = self.index_one_file(collection_id, file, semantic);
            }

            if i % BATCH == 0 || i + 1 == total {
                let _ = self.ev.blocking_send(Event::Progress {
                    collection: collection_id,
                    done: i + 1,
                    total,
                    current: path_str,
                });
                self.drain_cooperatively(cmd_rx, queue);
            }
        }

        let now = now_secs();
        let _ = db::mark_indexed(&self.conn, collection_id, now);
        self.emit_collections();
        let _ = self.ev.blocking_send(Event::Indexed(collection_id));
    }

    fn index_one_file(
        &mut self,
        collection_id: i64,
        file: &walk::Found,
        semantic: bool,
    ) -> rusqlite::Result<()> {
        let path_str = file.path.to_string_lossy().into_owned();
        let file_id = db::upsert_file(
            &self.conn,
            collection_id,
            &path_str,
            file.mtime,
            file.size as i64,
            now_secs(),
        )?;
        db::clear_file_chunks(&self.conn, file_id)?;

        let text = match extract::extract(&file.path, file.kind) {
            Ok(t) => t,
            Err(_) => return Ok(()), // unreadable/binary: nothing to index
        };

        let mut chunk_ids = Vec::new();
        let mut chunk_texts = Vec::new();
        for c in chunk::chunk_text(&text) {
            let cid = db::insert_chunk(
                &self.conn,
                file_id,
                c.ordinal as i64,
                c.char_start as i64,
                c.char_end as i64,
                &c.text,
            )?;
            chunk_ids.push(cid);
            chunk_texts.push(c.text);
        }

        if semantic && !chunk_texts.is_empty() {
            if let Some(vectors) = self.embed(chunk_texts) {
                for (cid, v) in chunk_ids.iter().zip(vectors.iter()) {
                    let _ = db::insert_embedding(&self.conn, *cid, v);
                }
            }
        }
        Ok(())
    }

    fn set_semantic(
        &mut self,
        cmd_rx: &Receiver<Command>,
        queue: &mut VecDeque<Command>,
        id: i64,
        on: bool,
    ) {
        let _ = db::set_collection_semantic(&self.conn, id, on);
        if on {
            let _ = db::set_collection_status(&self.conn, id, "embedding");
            self.emit_collections();
            self.embed_existing(cmd_rx, queue, id);
            let _ = db::set_collection_status(&self.conn, id, "ready");
        } else {
            let _ = db::delete_collection_embeddings(&self.conn, id);
        }
        self.emit_collections();
    }

    /// Embed every chunk of an already-indexed collection (used when semantic is
    /// switched on after the FTS index already exists).
    fn embed_existing(
        &mut self,
        cmd_rx: &Receiver<Command>,
        queue: &mut VecDeque<Command>,
        collection_id: i64,
    ) {
        let _ = db::delete_collection_embeddings(&self.conn, collection_id);
        let pairs = match db::collection_chunk_texts(&self.conn, collection_id) {
            Ok(p) => p,
            Err(e) => {
                self.emit_error(format!("read chunks: {e}"));
                return;
            }
        };
        let total = pairs.len();
        let mut done = 0;
        for batch in pairs.chunks(EMBED_BATCH) {
            let ids: Vec<i64> = batch.iter().map(|(id, _)| *id).collect();
            let texts: Vec<String> = batch.iter().map(|(_, t)| t.clone()).collect();
            if let Some(vectors) = self.embed(texts) {
                for (cid, v) in ids.iter().zip(vectors.iter()) {
                    let _ = db::insert_embedding(&self.conn, *cid, v);
                }
            } else {
                break; // model failed; error already emitted
            }
            done += batch.len();
            self.emit_status(Some(format!("Embedding {done}/{total}\u{2026}")));
            self.drain_cooperatively(cmd_rx, queue);
        }
        self.emit_status(None);
    }

    fn do_search(&mut self, seq: u64, query: String, mode: SearchMode) {
        let hits: Vec<SearchHit> = match mode {
            SearchMode::Name => {
                search::run_name_search(&self.conn, &query, SEARCH_LIMIT).unwrap_or_default()
            }
            SearchMode::Text => {
                search::run_text_search(&self.conn, &query, SEARCH_LIMIT).unwrap_or_default()
            }
            SearchMode::Semantic => match self.embed_query(&query) {
                Some(vec) => {
                    search::run_semantic_search(&self.conn, &vec, SEARCH_LIMIT).unwrap_or_default()
                }
                None => Vec::new(),
            },
        };
        let _ = self.ev.blocking_send(Event::Results { seq, hits });
    }

    /// Pull queued commands without blocking; run searches immediately (so the
    /// UI stays responsive mid-index) and defer everything else.
    fn drain_cooperatively(&mut self, cmd_rx: &Receiver<Command>, queue: &mut VecDeque<Command>) {
        while let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                Command::Search { seq, query, mode } => self.do_search(seq, query, mode),
                other => queue.push_back(other),
            }
        }
    }

    // --- embedding helpers ---

    fn embed(&mut self, texts: Vec<String>) -> Option<Vec<Vec<f32>>> {
        if !self.ensure_embedder() {
            return None;
        }
        let result = self.embedder.as_mut().unwrap().embed_batch(texts);
        match result {
            Ok(v) => Some(v),
            Err(e) => {
                self.emit_error(e);
                None
            }
        }
    }

    fn embed_query(&mut self, query: &str) -> Option<Vec<f32>> {
        if !self.ensure_embedder() {
            return None;
        }
        let result = self.embedder.as_mut().unwrap().embed_query(query);
        match result {
            Ok(v) => Some(v),
            Err(e) => {
                self.emit_error(e);
                None
            }
        }
    }

    fn ensure_embedder(&mut self) -> bool {
        if self.embedder.is_some() {
            return true;
        }
        self.emit_status(Some(
            "Loading embedding model (first run downloads ~90 MB)\u{2026}".to_string(),
        ));
        match Embedder::new() {
            Ok(e) => {
                self.embedder = Some(e);
                self.emit_status(None);
                true
            }
            Err(err) => {
                self.emit_status(None);
                self.emit_error(err);
                false
            }
        }
    }

    // --- event helpers ---

    fn emit_collections(&self) {
        if let Ok(list) = db::list_collections(&self.conn) {
            let _ = self.ev.blocking_send(Event::Collections(list));
        }
    }

    fn emit_status(&self, status: Option<String>) {
        let _ = self.ev.blocking_send(Event::Status(status));
    }

    fn emit_error(&self, msg: String) {
        let _ = self.ev.blocking_send(Event::Error(msg));
    }

    fn collection_root(&self, id: i64) -> rusqlite::Result<Option<PathBuf>> {
        self.conn
            .query_row("SELECT root FROM collections WHERE id = ?1", [id], |r| {
                Ok(PathBuf::from(r.get::<_, String>(0)?))
            })
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })
    }
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
