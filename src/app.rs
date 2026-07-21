use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::time::{Duration, Instant};

use iced::keyboard;
use iced::widget::{column, container, row, rule, stack};
use iced::{window, Element, Event, Length, Point, Size, Subscription, Task, Theme};

use crate::fs::ops::{self, Clipboard, ClipboardMode};
use crate::fs::{self, Drive, Entry, Platform, Shortcut};
use crate::index::{self, CollectionInfo, SearchHit, SearchMode};
use crate::message::Message;
use crate::navigation::History;
use crate::rag;
use crate::selection::Selection;
use crate::sort::{sort_entries, SortState};
use crate::ui;
use crate::ui::collections::{BusyKind, SPINNER};
use crate::ui::context::Menu;

const DOUBLE_CLICK: Duration = Duration::from_millis(400);

struct Renaming {
    index: usize,
    value: String,
}

#[derive(Default)]
struct SearchState {
    query: String,
    mode: SearchMode,
    results: Vec<SearchHit>,
    active: bool,
    searching: bool,
    seq: u64,
}

/// Tracks a first-time "Open with Index" ingestion so Lattice can show progress
/// and notify when the folder is ready — instead of opening an empty browser.
struct RagJob {
    scope_id: String, // empty until the scope is created
    name: String,
    done: usize,
    total: usize,
    finished: bool,
    stable: u8, // consecutive polls with done == total > 0
    error: Option<String>,
}

pub struct App {
    platform: Box<dyn Platform>,
    history: History,
    quick_access: Vec<Shortcut>,
    drives: Vec<Drive>,

    all_entries: Vec<Entry>, // unfiltered contents of the current dir
    entries: Vec<Entry>,     // filtered + sorted view (selection indexes into this)
    loading: bool,
    error: Option<String>,
    notice: Option<String>, // transient result of the last file operation

    selection: Selection,
    sort: SortState,
    show_hidden: bool,
    modifiers: keyboard::Modifiers,
    address_edit: Option<String>,
    expanded: BTreeMap<PathBuf, Vec<Entry>>,
    last_click: Option<(usize, Instant)>,

    clipboard: Option<Clipboard>,
    renaming: Option<Renaming>,
    context_menu: Option<Menu>,
    cursor: Point,
    // After creating a folder we reload, then drop into rename mode on this path.
    pending_rename: Option<PathBuf>,
    // After navigating from a search result, select this file once loaded.
    pending_select: Option<PathBuf>,

    // Indexer / search
    indexer_tx: Option<Sender<index::Command>>,
    collections: Vec<CollectionInfo>,
    index_status: Option<String>,
    search: SearchState,
    show_collections: bool,
    busy_collections: HashMap<i64, BusyKind>,
    // Progress tracking per collection: (done, total)
    index_progress: HashMap<i64, (usize, usize)>,
    spin_frame: usize,
    show_settings: bool,
    dark_mode: bool,
    sidecar: rag::Sidecar,
    rag_status: Option<String>,
    index_map: HashMap<String, String>, // canonical dir path -> scope id
    rag_job: Option<RagJob>,
    show_rag_modal: bool,
    // Scope to focus when we next open the web UI (from the already-indexed
    // fast path, where there's no RagJob to read the id from).
    rag_open_scope: Option<String>,

    // Windows (daemon mode)
    main_window: Option<window::Id>,
    spotlight_window: Option<window::Id>,
    spotlight_opened_at: Option<Instant>,
}

impl App {
    pub fn new() -> (Self, Task<Message>) {
        let platform = fs::current_platform();
        let home = platform.home_dir();
        let quick_access = platform.quick_access();
        let drives = platform.drives();

        let mut app = App {
            platform,
            history: History::new(home.clone()),
            quick_access,
            drives,
            all_entries: Vec::new(),
            entries: Vec::new(),
            loading: true,
            error: None,
            notice: None,
            selection: Selection::default(),
            sort: SortState::default(),
            show_hidden: false,
            modifiers: keyboard::Modifiers::default(),
            address_edit: None,
            expanded: BTreeMap::new(),
            last_click: None,
            clipboard: None,
            renaming: None,
            context_menu: None,
            cursor: Point::ORIGIN,
            pending_rename: None,
            pending_select: None,
            indexer_tx: None,
            collections: Vec::new(),
            index_status: None,
            search: SearchState::default(),
            show_collections: false,
            busy_collections: HashMap::new(),
            index_progress: HashMap::new(),
            spin_frame: 0,
            show_settings: false,
            dark_mode: load_dark_mode(),
            sidecar: rag::Sidecar::new(),
            rag_status: None,
            index_map: load_index_map(),
            rag_job: None,
            show_rag_modal: false,
            rag_open_scope: None,
            main_window: None,
            spotlight_window: None,
            spotlight_opened_at: None,
        };

        // Daemon mode opens no window on its own; open the explorer ourselves.
        let (main_id, open_main) = window::open(main_window_settings());
        app.main_window = Some(main_id);

        let init = Task::batch([open_main.discard(), load_dir(home)]);
        (app, init)
    }

    pub fn title(&self, window: window::Id) -> String {
        if Some(window) == self.spotlight_window {
            return "Lattice Search".to_string();
        }
        let here = self
            .history
            .current()
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| self.history.current().display().to_string());
        format!("{here} — Lattice")
    }

    pub fn theme(&self, _window: window::Id) -> Theme {
        if self.dark_mode {
            ui::style::ink_theme()
        } else {
            ui::style::paper_theme()
        }
    }

    pub fn update(&mut self, message: Message) -> Task<Message> {
        let busy = self.address_edit.is_some()
            || self.renaming.is_some()
            || !self.search.query.is_empty();
        match message {
            Message::Navigate(path) => {
                self.history.push(path);
                self.address_edit = None;
                self.reload()
            }
            Message::GoBack => {
                if busy {
                    return Task::none();
                }
                if self.history.back().is_some() {
                    self.reload()
                } else {
                    Task::none()
                }
            }
            Message::GoForward => {
                if busy {
                    return Task::none();
                }
                if self.history.forward().is_some() {
                    self.reload()
                } else {
                    Task::none()
                }
            }
            Message::GoUp => {
                if busy {
                    return Task::none();
                }
                if let Some(parent) = self.history.current().parent() {
                    let parent = parent.to_path_buf();
                    self.history.push(parent);
                    self.reload()
                } else {
                    Task::none()
                }
            }
            Message::Refresh => {
                if busy {
                    return Task::none();
                }
                self.drives = self.platform.drives();
                self.reload()
            }

            Message::DirLoaded { path, result } => {
                if path != self.history.current() {
                    return Task::none(); // stale load for a folder we've left
                }
                self.loading = false;
                match result {
                    Ok(list) => {
                        self.all_entries = list;
                        self.error = None;
                        self.rebuild();
                        // If we just created a folder, drop into rename mode on it.
                        if let Some(path) = self.pending_rename.take() {
                            if let Some(i) = self.entries.iter().position(|e| e.path == path) {
                                return self.begin_rename(i);
                            }
                        }
                        // If we navigated here from a search result, select the file.
                        if let Some(path) = self.pending_select.take() {
                            if let Some(i) = self.entries.iter().position(|e| e.path == path) {
                                self.selection.select_one(i);
                            }
                        }
                    }
                    Err(e) => {
                        self.all_entries.clear();
                        self.entries.clear();
                        self.error = Some(e);
                    }
                }
                Task::none()
            }
            Message::SubdirsLoaded { path, result } => {
                if !self.expanded.contains_key(&path) {
                    return Task::none(); // collapsed before the scan finished
                }
                if let Ok(mut list) = result {
                    if !self.show_hidden {
                        list.retain(|e| !e.hidden);
                    }
                    self.expanded.insert(path, list);
                }
                Task::none()
            }

            Message::EntryPressed(index) => {
                let now = Instant::now();
                let double = self
                    .last_click
                    .map_or(false, |(i, t)| i == index && now.duration_since(t) < DOUBLE_CLICK);
                self.last_click = Some((index, now));

                if self.modifiers.control() {
                    self.selection.toggle(index);
                } else if self.modifiers.shift() {
                    self.selection.select_range(index);
                } else {
                    self.selection.select_one(index);
                }

                if double {
                    return self.activate(index);
                }
                Task::none()
            }
            Message::BackgroundPressed => {
                self.selection.clear();
                self.last_click = None;
                Task::none()
            }
            Message::SelectAll => {
                if busy {
                    return Task::none();
                }
                self.selection.select_all(self.entries.len());
                Task::none()
            }
            Message::KeyActivate => {
                if busy {
                    return Task::none();
                }
                if let Some(i) = self.selection.single() {
                    return self.activate(i);
                }
                Task::none()
            }

            Message::SortBy(column) => {
                self.sort.apply_click(column);
                self.rebuild();
                Task::none()
            }

            Message::AddressEditStart => {
                self.address_edit = Some(self.history.current().display().to_string());
                iced::widget::operation::focus(ui::breadcrumb::ADDRESS_ID)
            }
            Message::AddressChanged(value) => {
                if let Some(buf) = self.address_edit.as_mut() {
                    *buf = value;
                }
                Task::none()
            }
            Message::AddressSubmit => {
                if let Some(value) = self.address_edit.take() {
                    let path = PathBuf::from(value.trim());
                    if path.is_dir() {
                        self.history.push(path);
                        return self.reload();
                    } else {
                        self.error = Some(format!("Can't find '{}'", path.display()));
                    }
                }
                Task::none()
            }
            Message::EscapePressed => {
                eprintln!("[win] EscapePressed (spotlight={:?})", self.spotlight_window);
                if let Some(id) = self.spotlight_window.take() {
                    return window::close(id);
                } else if self.show_rag_modal {
                    self.show_rag_modal = false; // background it; keep indexing
                } else if self.show_settings {
                    self.show_settings = false;
                } else if self.show_collections {
                    self.show_collections = false;
                } else if self.renaming.is_some() {
                    self.renaming = None;
                } else if self.address_edit.is_some() {
                    self.address_edit = None;
                } else if self.context_menu.is_some() {
                    self.context_menu = None;
                } else if self.search.active || !self.search.query.is_empty() {
                    self.search = SearchState::default();
                } else {
                    self.selection.clear();
                }
                Task::none()
            }

            Message::ToggleHidden => {
                self.show_hidden = !self.show_hidden;
                self.rebuild();
                Task::none()
            }

            Message::SidebarToggleExpand(path) => {
                if self.expanded.remove(&path).is_some() {
                    Task::none()
                } else {
                    self.expanded.insert(path.clone(), Vec::new());
                    load_subdirs(path)
                }
            }

            Message::Copy => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let paths = self.selected_paths();
                if !paths.is_empty() {
                    self.clipboard = Some(Clipboard {
                        paths,
                        mode: ClipboardMode::Copy,
                    });
                }
                Task::none()
            }
            Message::Cut => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let paths = self.selected_paths();
                if !paths.is_empty() {
                    self.clipboard = Some(Clipboard {
                        paths,
                        mode: ClipboardMode::Cut,
                    });
                }
                Task::none()
            }
            Message::Paste => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let Some(clip) = self.clipboard.clone() else {
                    return Task::none();
                };
                let dest = self.history.current().to_path_buf();
                match clip.mode {
                    ClipboardMode::Copy => {
                        Task::perform(ops::copy_into_async(clip.paths, dest), Message::OpDone)
                    }
                    ClipboardMode::Cut => {
                        self.clipboard = None;
                        Task::perform(ops::move_into_async(clip.paths, dest), Message::OpDone)
                    }
                }
            }
            Message::DeleteSelected => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let paths = self.selected_paths();
                if paths.is_empty() {
                    return Task::none();
                }
                Task::perform(ops::delete_to_trash_async(paths), Message::OpDone)
            }
            Message::NewFolder => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                match ops::create_folder(self.history.current()) {
                    Ok(path) => {
                        self.pending_rename = Some(path);
                        self.reload()
                    }
                    Err(e) => {
                        self.notice = Some(e);
                        Task::none()
                    }
                }
            }
            Message::RenameStart(index) => {
                self.context_menu = None;
                self.begin_rename(index)
            }
            Message::RenameSelected => {
                if busy {
                    return Task::none();
                }
                match self.selection.single() {
                    Some(i) => self.begin_rename(i),
                    None => Task::none(),
                }
            }
            Message::RenameChanged(value) => {
                if let Some(r) = self.renaming.as_mut() {
                    r.value = value;
                }
                Task::none()
            }
            Message::RenameSubmit => {
                if let Some(r) = self.renaming.take() {
                    if let Some(entry) = self.entries.get(r.index) {
                        let path = entry.path.clone();
                        match ops::rename(&path, &r.value) {
                            Ok(_) => return self.reload(),
                            Err(e) => self.notice = Some(e),
                        }
                    }
                }
                Task::none()
            }
            Message::ActivateEntry(index) => {
                self.context_menu = None;
                self.activate(index)
            }
            Message::OpDone(result) => {
                let task = self.reload();
                self.notice = result.err();
                task
            }

            Message::CursorMoved(point) => {
                self.cursor = point;
                Task::none()
            }
            Message::EntryRightPressed(index) => {
                if !self.selection.contains(index) {
                    self.selection.select_one(index);
                }
                self.context_menu = Some(Menu {
                    position: self.cursor,
                    target: Some(index),
                });
                Task::none()
            }
            Message::BackgroundRightPressed => {
                self.selection.clear();
                self.context_menu = Some(Menu {
                    position: self.cursor,
                    target: None,
                });
                Task::none()
            }
            Message::ContextClose => {
                self.context_menu = None;
                Task::none()
            }

            Message::IndexerReady(tx) => {
                eprintln!("[ui] IndexerReady: worker command channel connected");
                self.indexer_tx = Some(tx);
                Task::none()
            }
            Message::Indexer(event) => self.handle_index_event(event),
            Message::IndexCurrentFolder => {
                let root = self.history.current().to_path_buf();
                self.send_command(index::Command::AddCollection(root));
                self.index_status = Some("Indexing\u{2026}".to_string());
                Task::none()
            }
            Message::FocusSearch => iced::widget::operation::focus(ui::search::SEARCH_ID),
            Message::SearchInput(value) => {
                self.search.query = value;
                Task::none()
            }
            Message::SearchSubmit => {
                let query = self.search.query.trim().to_string();
                if query.is_empty() {
                    self.search.active = false;
                    self.search.results.clear();
                    return Task::none();
                }
                self.search.seq += 1;
                self.search.active = true;
                self.search.searching = true;
                self.send_command(index::Command::Search {
                    seq: self.search.seq,
                    query,
                    mode: self.search.mode,
                });
                Task::none()
            }
            Message::SearchClear => {
                self.search.query.clear();
                self.search.results.clear();
                self.search.active = false;
                self.search.searching = false;
                Task::none()
            }
            Message::SearchModeChanged(mode) => {
                self.search.mode = mode;
                if self.search.active && !self.search.query.trim().is_empty() {
                    self.search.seq += 1;
                    self.search.searching = true;
                    self.send_command(index::Command::Search {
                        seq: self.search.seq,
                        query: self.search.query.trim().to_string(),
                        mode,
                    });
                }
                Task::none()
            }
            Message::OpenResult(path) => {
                if let Some(parent) = path.parent() {
                    let parent = parent.to_path_buf();
                    self.pending_select = Some(path.clone());
                    self.search = SearchState::default();
                    self.history.push(parent);
                    let reload = self.reload();

                    // If opened from the Spotlight launcher, close it and raise
                    // the explorer at the result (reopening it if hidden to tray).
                    let mut tasks = vec![reload];
                    if let Some(sid) = self.spotlight_window.take() {
                        tasks.push(window::close(sid));
                    }
                    match self.main_window {
                        Some(mid) => tasks.push(window::gain_focus(mid)),
                        None => {
                            let (id, open) = window::open(main_window_settings());
                            self.main_window = Some(id);
                            tasks.push(open.discard());
                        }
                    }
                    return Task::batch(tasks);
                }
                Task::none()
            }

            Message::CollectionsOpen => {
                self.show_settings = false; // may be launched from the Settings modal
                self.show_collections = true;
                Task::none()
            }
            Message::CollectionsClose => {
                eprintln!("[ui] CollectionsClose");
                self.show_collections = false;
                Task::none()
            }
            Message::CollectionRemove(id) => {
                eprintln!("[ui] CollectionRemove({id})");
                self.busy_collections.insert(id, BusyKind::Removing);
                self.send_command(index::Command::RemoveCollection(id));
                Task::none()
            }
            Message::CollectionReindex(id) => {
                eprintln!("[ui] CollectionReindex({id})");
                self.busy_collections.insert(id, BusyKind::Reindexing);
                self.send_command(index::Command::Reindex(id));
                Task::none()
            }
            Message::CollectionSemantic(id, on) => {
                eprintln!("[ui] CollectionSemantic({id}, {on})");
                if on {
                    self.busy_collections.insert(id, BusyKind::Embedding);
                } else {
                    self.busy_collections.remove(&id);
                }
                self.send_command(index::Command::SetSemantic(id, on));
                Task::none()
            }
            Message::SpinTick => {
                self.spin_frame = self.spin_frame.wrapping_add(1);
                Task::none()
            }

            Message::SettingsOpen => {
                self.show_settings = true;
                Task::none()
            }
            Message::SettingsClose => {
                self.show_settings = false;
                Task::none()
            }
            Message::ToggleDarkMode => {
                self.dark_mode = !self.dark_mode;
                save_dark_mode(self.dark_mode);
                Task::none()
            }

            Message::ToggleSpotlight => {
                if let Some(id) = self.spotlight_window.take() {
                    window::close(id)
                } else {
                    self.open_spotlight()
                }
            }
            Message::ShowMainWindow => {
                if let Some(id) = self.main_window {
                    window::gain_focus(id)
                } else {
                    let (id, open) = window::open(main_window_settings());
                    self.main_window = Some(id);
                    open.discard()
                }
            }
            Message::OpenWithIndex(index) => {
                let Some(entry) = self.entries.get(index) else {
                    return Task::none();
                };
                if !entry.is_dir {
                    return Task::none();
                }
                let dir = entry.path.clone();
                if let Err(e) = self.sidecar.ensure_spawned() {
                    self.rag_status = Some(format!("Couldn't start index sidecar: {e}"));
                    return Task::none();
                }
                let key = canonical_key(&dir);
                let name = dir
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| dir.display().to_string());

                if let Some(scope_id) = self.index_map.get(&key) {
                    // Already indexed — just open the chat UI once healthy,
                    // focused on this folder's scope.
                    self.rag_open_scope = Some(scope_id.clone());
                    self.rag_status = Some(format!("Opening {name} in Index\u{2026}"));
                    Task::perform(rag::ensure_ready(), Message::RagReadyToOpen)
                } else {
                    // First time — show the progress modal and start ingestion.
                    self.rag_job = Some(RagJob {
                        scope_id: String::new(),
                        name,
                        done: 0,
                        total: 0,
                        finished: false,
                        stable: 0,
                        error: None,
                    });
                    self.show_rag_modal = true;
                    self.rag_status = None;
                    Task::perform(rag::open_with_index(dir), move |result| {
                        Message::RagIndexStarted {
                            path: key.clone(),
                            result,
                        }
                    })
                }
            }
            Message::RagReadyToOpen(ready) => {
                if ready {
                    rag::open_browser(&rag::web_url(self.rag_open_scope.as_deref()));
                    self.rag_open_scope = None;
                    self.rag_status = None;
                } else {
                    self.rag_status = Some("Index sidecar didn't start in time".to_string());
                }
                Task::none()
            }
            Message::RagIndexStarted { path, result } => {
                match result {
                    Ok(scope_id) => {
                        self.index_map.insert(path, scope_id.clone());
                        save_index_map(&self.index_map);
                        if let Some(job) = self.rag_job.as_mut() {
                            job.scope_id = scope_id;
                        }
                    }
                    Err(e) => {
                        if let Some(job) = self.rag_job.as_mut() {
                            job.error = Some(e);
                        }
                    }
                }
                Task::none()
            }
            Message::RagPollTick => {
                match &self.rag_job {
                    Some(job) if !job.finished && job.error.is_none() && !job.scope_id.is_empty() => {
                        Task::perform(rag::document_progress(job.scope_id.clone()), Message::RagProgress)
                    }
                    _ => Task::none(),
                }
            }
            Message::RagProgress(result) => {
                if let (Some(job), Ok((done, total))) = (self.rag_job.as_mut(), result) {
                    let unchanged = done == job.done && total == job.total;
                    job.done = done;
                    job.total = total;
                    if total > 0 && done == total {
                        job.stable = if unchanged { job.stable.saturating_add(1) } else { 1 };
                        if job.stable >= 2 && !job.finished {
                            job.finished = true;
                            let name = job.name.clone();
                            self.show_rag_modal = true; // pop back up as the "ready" notice
                            self.rag_status = Some(format!("\u{2713} {name} is ready in Index"));
                            rag::os_notify(
                                &format!("{name} is ready in Index"),
                                "Open it to chat with the folder's contents.",
                            );
                        }
                    } else {
                        job.stable = 0;
                    }
                }
                Task::none()
            }
            Message::RagOpenBrowser => {
                let scope = self.rag_job.as_ref().map(|j| j.scope_id.clone());
                rag::open_browser(&rag::web_url(scope.as_deref()));
                self.show_rag_modal = false;
                self.rag_job = None;
                self.rag_status = None;
                Task::none()
            }
            Message::RagModalBackground => {
                self.show_rag_modal = false; // keep the job + polling running
                Task::none()
            }
            Message::RagModalDismiss => {
                self.show_rag_modal = false;
                self.rag_job = None; // stop tracking (sidecar keeps ingesting)
                Task::none()
            }
            Message::QuitApp => {
                self.sidecar.shutdown();
                iced::exit()
            }
            Message::WindowCloseRequested(id) => {
                if Some(id) == self.spotlight_window {
                    self.spotlight_window = None;
                    window::close(id)
                } else if Some(id) == self.main_window {
                    // Hide to tray: close the window, keep the daemon alive.
                    self.main_window = None;
                    window::close(id)
                } else {
                    window::close(id)
                }
            }
            Message::WindowUnfocused(id) => {
                // The Spotlight launcher dismisses when it loses focus — but
                // ignore the transient unfocus that fires as the window opens.
                let is_spot = Some(id) == self.spotlight_window;
                eprintln!("[win] Unfocused id_is_spotlight={is_spot}");
                if is_spot {
                    let settled = self
                        .spotlight_opened_at
                        .map_or(true, |t| t.elapsed() > Duration::from_millis(600));
                    if settled {
                        self.spotlight_window = None;
                        return window::close(id);
                    }
                }
                Task::none()
            }

            Message::ModifiersChanged(m) => {
                self.modifiers = m;
                Task::none()
            }
        }
    }

    pub fn view(&self, window: window::Id) -> Element<'_, Message> {
        if Some(window) == self.spotlight_window {
            return ui::spotlight::view(
                &self.search.query,
                self.search.mode,
                &self.search.results,
                self.search.searching,
            );
        }
        self.explorer_view()
    }

    fn explorer_view(&self) -> Element<'_, Message> {
        let current = self.history.current();

        let toolbar = ui::toolbar::view(
            current,
            self.address_edit.as_deref(),
            self.history.can_go_back(),
            self.history.can_go_forward(),
            current.parent().is_some(),
            &self.search.query,
            self.search.searching,
        );

        let sidebar = ui::sidebar::view(&self.quick_access, &self.drives, &self.expanded, current);

        // The main panel is either search results or the browsing file list.
        let panel: Element<'_, Message> = if self.search.active {
            ui::search::results(&self.search.results, &self.search.query, self.search.searching)
        } else {
            let renaming = self.renaming.as_ref().map(|r| (r.index, r.value.as_str()));
            // The folder's own name titles its header (drive-root falls back to its path).
            let folder_title = current
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| current.display().to_string());
            ui::file_list::view(
                folder_title,
                &self.entries,
                &self.selection,
                self.sort,
                self.loading,
                self.error.as_deref(),
                renaming,
            )
        };

        let status = ui::status_bar::view(
            &self.entries,
            &self.selection,
            self.rag_status.as_deref().or(self.index_status.as_deref()),
            self.notice.as_deref(),
        );

        // Inspector shows the single selected browsing entry (never during search,
        // where selection indexes don't map to the results list).
        let selected_entry = if self.search.active {
            None
        } else {
            self.selection.single().and_then(|i| self.entries.get(i))
        };
        let inspector = ui::inspector::view(selected_entry);

        let body = row![
            sidebar,
            rule::vertical(1),
            container(panel).width(Length::Fill).height(Length::Fill),
            rule::vertical(1),
            inspector,
        ]
        .height(Length::Fill);

        let mut content = column![toolbar, rule::horizontal(1)];
        // The search-mode strip only appears while a search is active.
        if self.search.active {
            content = content
                .push(ui::search::modes_bar(self.search.mode, self.search.searching))
                .push(rule::horizontal(1));
        }
        let content = content
            .push(body)
            .push(rule::horizontal(1))
            .push(status);

        if self.show_rag_modal {
            if let Some(job) = &self.rag_job {
                let spinner = SPINNER[self.spin_frame % SPINNER.len()];
                let overlay = ui::rag_modal::view(
                    &job.name,
                    job.done,
                    job.total,
                    job.finished,
                    job.error.as_deref(),
                    spinner,
                );
                return stack![content, overlay].into();
            }
        }

        if self.show_settings {
            let overlay = ui::settings::view(self.dark_mode, self.show_hidden);
            return stack![content, overlay].into();
        }

        if self.show_collections {
            let spinner = SPINNER[self.spin_frame % SPINNER.len()];
            let overlay = ui::collections::view(
                &self.collections,
                current,
                &self.busy_collections,
                &self.index_progress,
                spinner,
            );
            return stack![content, overlay].into();
        }

        match &self.context_menu {
            Some(menu) => {
                let target_is_dir = menu
                    .target
                    .and_then(|i| self.entries.get(i))
                    .map(|e| e.is_dir)
                    .unwrap_or(false);
                let overlay =
                    ui::context::view(menu, self.clipboard.is_some(), target_is_dir);
                stack![content, overlay].into()
            }
            None => content.into(),
        }
    }

    pub fn subscription(&self) -> Subscription<Message> {
        let input = iced::event::listen_with(|event, _status, id| match event {
            Event::Keyboard(keyboard::Event::ModifiersChanged(m)) => {
                Some(Message::ModifiersChanged(m))
            }
            Event::Keyboard(keyboard::Event::KeyPressed { key, modifiers, .. }) => {
                map_key(key, modifiers)
            }
            Event::Mouse(iced::mouse::Event::CursorMoved { position }) => {
                Some(Message::CursorMoved(position))
            }
            Event::Window(window::Event::CloseRequested) => {
                Some(Message::WindowCloseRequested(id))
            }
            Event::Window(window::Event::Unfocused) => Some(Message::WindowUnfocused(id)),
            _ => None,
        });

        let mut subs = vec![input, Subscription::run(index::connect)];
        #[cfg(windows)]
        subs.push(Subscription::run(crate::system::connect));
        let rag_active = self
            .rag_job
            .as_ref()
            .is_some_and(|j| !j.finished && j.error.is_none());
        if !self.busy_collections.is_empty() || (self.show_rag_modal && rag_active) {
            subs.push(iced::time::every(Duration::from_millis(90)).map(|_| Message::SpinTick));
        }
        if rag_active {
            // Poll ingestion progress while a first-time index runs (even if the
            // modal was sent to the background).
            subs.push(iced::time::every(Duration::from_millis(1500)).map(|_| Message::RagPollTick));
        }
        Subscription::batch(subs)
    }

    // --- helpers ---

    fn reload(&mut self) -> Task<Message> {
        self.loading = true;
        self.error = None;
        self.notice = None;
        self.index_status = None;
        self.selection.clear();
        self.last_click = None;
        self.address_edit = None;
        self.renaming = None;
        self.context_menu = None;
        load_dir(self.history.current().to_path_buf())
    }

    fn open_spotlight(&mut self) -> Task<Message> {
        self.search = SearchState::default(); // fresh launcher, defaults to Name mode
        let (id, open) = window::open(window::Settings {
            size: Size::new(ui::spotlight::WIDTH, ui::spotlight::BASE_HEIGHT),
            position: window::Position::SpecificWith(spotlight_position),
            decorations: false,
            resizable: false,
            transparent: true,
            level: window::Level::AlwaysOnTop,
            exit_on_close_request: false,
            ..window::Settings::default()
        });
        self.spotlight_window = Some(id);
        self.spotlight_opened_at = Some(Instant::now());
        Task::batch([
            open.discard(),
            window::gain_focus(id),
            iced::widget::operation::focus(ui::spotlight::SPOTLIGHT_ID),
        ])
    }

    /// Desired Spotlight window height: compact when empty, a fixed expanded
    /// height otherwise (results scroll within, so it never runs off-screen).
    fn spotlight_height(results: usize, searching: bool) -> f32 {
        if results == 0 && !searching {
            ui::spotlight::BASE_HEIGHT
        } else {
            ui::spotlight::BASE_HEIGHT + ui::spotlight::RESULTS_HEIGHT
        }
    }

    fn send_command(&self, command: index::Command) {
        match &self.indexer_tx {
            Some(tx) => {
                eprintln!("[ui] send_command: {command:?}");
                let ok = tx.send(command).is_ok();
                eprintln!("[ui] send_command: sent_ok={ok}");
            }
            None => eprintln!("[ui] send_command: NO WORKER (tx=None) for {command:?}"),
        }
    }

    fn handle_index_event(&mut self, event: index::Event) -> Task<Message> {
        match event {
            index::Event::Collections(list) => {
                // Clear a collection's spinner once it's gone or back to "ready".
                let ongoing: std::collections::HashSet<i64> = list
                    .iter()
                    .filter(|c| c.status != "ready")
                    .map(|c| c.id)
                    .collect();
                self.collections = list;
                self.busy_collections.retain(|id, _| ongoing.contains(id));
                // Clear progress for collections that finished
                self.index_progress.retain(|id, _| ongoing.contains(id));
            }
            index::Event::Progress { collection, done, total, .. } => {
                self.index_progress.insert(collection, (done, total));
                self.index_status = Some(format!("Indexing {done}/{total}\u{2026}"));
            }
            index::Event::Indexed(id) => {
                // Clear progress and persist a visible confirmation (small folders index instantly).
                self.index_progress.remove(&id);
                let files = self
                    .collections
                    .iter()
                    .find(|c| c.id == id)
                    .map(|c| c.file_count)
                    .unwrap_or(0);
                let name = self
                    .collections
                    .iter()
                    .find(|c| c.id == id)
                    .and_then(|c| c.root.file_name())
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default();
                self.index_status = Some(format!("\u{2713} Indexed {name} ({files} files)"));
            }
            index::Event::Results { seq, hits } => {
                if seq == self.search.seq {
                    self.search.results = hits;
                    self.search.searching = false;
                    // Grow/shrink the Spotlight window to fit the results.
                    if let Some(id) = self.spotlight_window {
                        let h = Self::spotlight_height(self.search.results.len(), false);
                        return window::resize(id, Size::new(ui::spotlight::WIDTH, h));
                    }
                }
            }
            index::Event::Status(status) => {
                self.index_status = status;
            }
            index::Event::Error(e) => {
                self.index_status = None;
                self.notice = Some(e);
            }
        }
        Task::none()
    }

    fn selected_paths(&self) -> Vec<PathBuf> {
        self.selection
            .indices()
            .filter_map(|i| self.entries.get(i))
            .map(|e| e.path.clone())
            .collect()
    }

    fn begin_rename(&mut self, index: usize) -> Task<Message> {
        if let Some(entry) = self.entries.get(index) {
            self.selection.select_one(index);
            self.renaming = Some(Renaming {
                index,
                value: entry.name.clone(),
            });
            return iced::widget::operation::focus(ui::file_list::RENAME_ID);
        }
        Task::none()
    }

    fn rebuild(&mut self) {
        let mut v: Vec<Entry> = self
            .all_entries
            .iter()
            .filter(|e| self.show_hidden || !e.hidden)
            .cloned()
            .collect();
        sort_entries(&mut v, self.sort);
        self.entries = v;
        self.selection.clear();
        self.last_click = None;
    }

    fn activate(&mut self, index: usize) -> Task<Message> {
        if let Some(entry) = self.entries.get(index) {
            if entry.is_dir {
                let path = entry.path.clone();
                self.history.push(path);
                return self.reload();
            }
        }
        Task::none()
    }
}

/// Position the Spotlight window centered horizontally, in the upper third of
/// the screen (so it has room to expand downward without hitting the edge).
fn spotlight_position(win: Size, monitor: Size) -> iced::Point {
    iced::Point::new(
        ((monitor.width - win.width) / 2.0).max(0.0),
        (monitor.height * 0.16).max(0.0),
    )
}

fn settings_path() -> PathBuf {
    index::db::data_dir().join("settings.conf")
}

fn load_dark_mode() -> bool {
    std::fs::read_to_string(settings_path())
        .map(|s| s.contains("dark=true"))
        .unwrap_or(false)
}

fn save_dark_mode(dark: bool) {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, format!("dark={dark}\n"));
}

fn index_map_path() -> PathBuf {
    index::db::data_dir().join("index_scopes.json")
}

/// Canonical key for a directory in the path→scope map (case/`..`-normalized).
fn canonical_key(dir: &std::path::Path) -> String {
    dir.canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| dir.to_string_lossy().into_owned())
}

fn load_index_map() -> HashMap<String, String> {
    std::fs::read_to_string(index_map_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_index_map(map: &HashMap<String, String>) {
    let path = index_map_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = std::fs::write(path, json);
    }
}

fn main_window_settings() -> window::Settings {
    window::Settings {
        size: Size::new(1100.0, 720.0),
        position: window::Position::Centered,
        exit_on_close_request: false, // intercepted to hide-to-tray
        icon: app_icon(),
        ..window::Settings::default()
    }
}

/// The window/taskbar icon, decoded from the bundled brand asset (baked into the
/// binary so there's no runtime file dependency). `None` if decoding fails.
fn app_icon() -> Option<window::Icon> {
    let bytes = include_bytes!("../branding/icon-256.png");
    window::icon::from_file_data(bytes, None).ok()
}

fn load_dir(path: PathBuf) -> Task<Message> {
    Task::perform(fs::scan_dir_async(path.clone()), move |result| {
        Message::DirLoaded {
            path: path.clone(),
            result,
        }
    })
}

fn load_subdirs(path: PathBuf) -> Task<Message> {
    Task::perform(fs::scan_subdirs_async(path.clone()), move |result| {
        Message::SubdirsLoaded {
            path: path.clone(),
            result,
        }
    })
}

fn map_key(key: keyboard::Key, modifiers: keyboard::Modifiers) -> Option<Message> {
    use keyboard::key::Named;
    use keyboard::Key;
    match key {
        Key::Named(Named::Enter) => Some(Message::KeyActivate),
        Key::Named(Named::Backspace) => Some(Message::GoUp),
        Key::Named(Named::F5) => Some(Message::Refresh),
        Key::Named(Named::F2) => Some(Message::RenameSelected),
        Key::Named(Named::Delete) => Some(Message::DeleteSelected),
        Key::Named(Named::Escape) => Some(Message::EscapePressed),
        Key::Named(Named::ArrowLeft) if modifiers.alt() => Some(Message::GoBack),
        Key::Named(Named::ArrowRight) if modifiers.alt() => Some(Message::GoForward),
        Key::Character(ref c) if modifiers.control() => {
            let c = c.as_str();
            if modifiers.shift() && c.eq_ignore_ascii_case("n") {
                Some(Message::NewFolder)
            } else if c.eq_ignore_ascii_case("a") {
                Some(Message::SelectAll)
            } else if c.eq_ignore_ascii_case("c") {
                Some(Message::Copy)
            } else if c.eq_ignore_ascii_case("x") {
                Some(Message::Cut)
            } else if c.eq_ignore_ascii_case("v") {
                Some(Message::Paste)
            } else if c.eq_ignore_ascii_case("f") {
                Some(Message::FocusSearch)
            } else {
                None
            }
        }
        _ => None,
    }
}
