pub mod core;

use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender as CmdSender;
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

use core::fs::entry::{Entry, EntryKind};
use core::fs::{ops, platform, scan};
use core::index::{self, Command, SearchHit};
use core::index::search::SearchMode;
use core::index::db::CollectionInfo;

// ---------- DTOs (serialized to the React frontend) ----------

#[derive(Serialize)]
struct EntryDto {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: Option<u64>, // ms since epoch
    kind: String,
    type_label: String,
    hidden: bool,
}

fn kind_str(k: EntryKind) -> &'static str {
    match k {
        EntryKind::Folder => "folder",
        EntryKind::Drive => "folder",
        EntryKind::Image => "image",
        EntryKind::Audio => "audio",
        EntryKind::Video => "video",
        EntryKind::Archive => "archive",
        EntryKind::Document => "document",
        EntryKind::Code => "code",
        EntryKind::Executable => "executable",
        EntryKind::Other => "other",
    }
}

fn to_dto(e: Entry) -> EntryDto {
    let modified = e
        .modified
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    EntryDto {
        type_label: e.type_label(),
        name: e.name,
        path: e.path.to_string_lossy().into_owned(),
        is_dir: e.is_dir,
        size: e.size,
        modified,
        kind: kind_str(e.kind).into(),
        hidden: e.hidden,
    }
}

#[derive(Serialize)]
struct DriveDto {
    letter: String,
    name: String,
    display: String,
    path: String,
}

#[derive(Serialize)]
struct ShortcutDto {
    label: String,
    path: String,
}

// ---------- commands ----------

#[tauri::command]
async fn list_dir(path: String, show_hidden: bool) -> Result<Vec<EntryDto>, String> {
    let entries = scan::scan_dir_async(PathBuf::from(path)).await?;
    Ok(entries
        .into_iter()
        .filter(|e| show_hidden || !e.hidden)
        .map(to_dto)
        .collect())
}

#[tauri::command]
fn drives() -> Vec<DriveDto> {
    platform::current()
        .drives()
        .into_iter()
        .map(|d| {
            let display = d.display();
            DriveDto {
                letter: d.letter,
                name: d.name,
                display,
                path: d.path.to_string_lossy().into_owned(),
            }
        })
        .collect()
}

#[tauri::command]
fn quick_access() -> Vec<ShortcutDto> {
    platform::current()
        .quick_access()
        .into_iter()
        .map(|s| ShortcutDto {
            label: s.label,
            path: s.path.to_string_lossy().into_owned(),
        })
        .collect()
}

#[tauri::command]
fn home_dir() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| "C:/".into())
}

#[tauri::command]
fn new_folder(dir: String) -> Result<String, String> {
    ops::create_folder(Path::new(&dir)).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn rename(path: String, new_name: String) -> Result<String, String> {
    ops::rename(Path::new(&path), &new_name).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
async fn copy_items(sources: Vec<String>, dest: String) -> Result<(), String> {
    ops::copy_into_async(sources.into_iter().map(PathBuf::from).collect(), PathBuf::from(dest)).await
}

#[tauri::command]
async fn move_items(sources: Vec<String>, dest: String) -> Result<(), String> {
    ops::move_into_async(sources.into_iter().map(PathBuf::from).collect(), PathBuf::from(dest)).await
}

#[tauri::command]
async fn delete_items(paths: Vec<String>) -> Result<(), String> {
    ops::delete_to_trash_async(paths.into_iter().map(PathBuf::from).collect()).await
}

#[tauri::command]
fn open_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn reveal(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener().reveal_item_in_dir(path).map_err(|e| e.to_string())
}

// ---------- search + indexing ----------

struct IndexState {
    tx: Mutex<CmdSender<Command>>,
    collections: Arc<Mutex<Vec<CollectionInfo>>>,
}

#[derive(Serialize, Clone)]
struct ProgressDto { collection: i64, done: usize, total: usize, current: String }
#[derive(Serialize, Clone)]
struct ResultsDto { seq: u64, hits: Vec<SearchHit> }

fn send_cmd(state: &IndexState, cmd: Command) -> Result<(), String> {
    state.tx.lock().unwrap().send(cmd).map_err(|e| e.to_string())
}

#[tauri::command]
fn search(state: State<IndexState>, seq: u64, query: String, mode: String) -> Result<(), String> {
    let mode = match mode.as_str() {
        "text" => SearchMode::Text,
        "semantic" => SearchMode::Semantic,
        _ => SearchMode::Name,
    };
    send_cmd(&state, Command::Search { seq, query, mode })
}

#[tauri::command]
fn index_folder(state: State<IndexState>, path: String) -> Result<(), String> {
    send_cmd(&state, Command::AddCollection(PathBuf::from(path)))
}

#[tauri::command]
fn reindex(state: State<IndexState>, id: i64) -> Result<(), String> {
    send_cmd(&state, Command::Reindex(id))
}

#[tauri::command]
fn remove_collection(state: State<IndexState>, id: i64) -> Result<(), String> {
    send_cmd(&state, Command::RemoveCollection(id))
}

#[tauri::command]
fn set_semantic(state: State<IndexState>, id: i64, on: bool) -> Result<(), String> {
    send_cmd(&state, Command::SetSemantic(id, on))
}

#[tauri::command]
fn collections(state: State<IndexState>) -> Vec<CollectionInfo> {
    state.collections.lock().unwrap().clone()
}

// ---------- app launcher (Start Menu shortcuts) ----------

#[derive(Serialize, Clone)]
struct AppMatch {
    name: String,
    path: String,
}

fn all_apps() -> &'static Vec<AppMatch> {
    static APPS: std::sync::OnceLock<Vec<AppMatch>> = std::sync::OnceLock::new();
    APPS.get_or_init(|| {
        let mut out = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let roots = [
            std::env::var("ProgramData").ok().map(|p| PathBuf::from(p).join(r"Microsoft\Windows\Start Menu\Programs")),
            std::env::var("APPDATA").ok().map(|p| PathBuf::from(p).join(r"Microsoft\Windows\Start Menu\Programs")),
        ];
        for root in roots.into_iter().flatten() {
            collect_lnks(&root, &mut out, &mut seen);
        }
        out
    })
}

fn collect_lnks(dir: &Path, out: &mut Vec<AppMatch>, seen: &mut std::collections::HashSet<String>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        if p.is_dir() {
            collect_lnks(&p, out, seen);
        } else if p.extension().and_then(|x| x.to_str()).is_some_and(|x| x.eq_ignore_ascii_case("lnk")) {
            if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                // skip uninstallers and noise
                let low = stem.to_lowercase();
                if low.contains("uninstall") || low.contains("readme") {
                    continue;
                }
                if seen.insert(low) {
                    out.push(AppMatch { name: stem.to_string(), path: p.to_string_lossy().into_owned() });
                }
            }
        }
    }
}

#[tauri::command]
fn search_apps(query: String) -> Vec<AppMatch> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Vec::new();
    }
    let mut scored: Vec<(u8, &AppMatch)> = all_apps()
        .iter()
        .filter_map(|a| {
            let n = a.name.to_lowercase();
            let rank = if n == q { 0 }
                else if n.starts_with(&q) { 1 }
                else if n.split(|c: char| !c.is_alphanumeric()).any(|w| w.starts_with(&q)) { 2 }
                else if n.contains(&q) { 3 }
                else { return None };
            Some((rank, a))
        })
        .collect();
    scored.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.name.len().cmp(&b.1.name.len())));
    scored.into_iter().take(6).map(|(_, a)| a.clone()).collect()
}

// ---------- windows / tray ----------

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn toggle_spotlight(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("spotlight") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.center();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let alt_space = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                    if event.state == ShortcutState::Pressed && shortcut == &alt_space {
                        toggle_spotlight(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Global Alt+Space toggles the Spotlight window.
            let alt_space = Shortcut::new(Some(Modifiers::ALT), Code::Space);
            let _ = app.global_shortcut().register(alt_space);

            // System tray with a small menu; left-click shows the main window.
            let show = MenuItem::with_id(app, "show", "Show Lattice", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Lattice")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Close-to-tray: hide the main window instead of quitting.
            if let Some(main) = app.get_webview_window("main") {
                let m = main.clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = m.hide();
                    }
                });
            }

            // Spawn the indexer worker (owns the DB + embedding model) and forward
            // its events to the frontend as `index:*` Tauri events.
            let (tx, mut ev_rx) = index::spawn();
            let collections = Arc::new(Mutex::new(Vec::new()));
            app.manage(IndexState { tx: Mutex::new(tx), collections: collections.clone() });

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use index::Event::*;
                while let Some(ev) = ev_rx.recv().await {
                    match ev {
                        Collections(list) => {
                            *collections.lock().unwrap() = list.clone();
                            let _ = handle.emit("index:collections", &list);
                        }
                        Progress { collection, done, total, current } => {
                            let _ = handle.emit("index:progress", ProgressDto { collection, done, total, current });
                        }
                        Indexed(id) => { let _ = handle.emit("index:indexed", id); }
                        Results { seq, hits } => { let _ = handle.emit("index:results", ResultsDto { seq, hits }); }
                        Status(s) => { let _ = handle.emit("index:status", s); }
                        Error(e) => { let _ = handle.emit("index:error", e); }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_dir, drives, quick_access, home_dir,
            new_folder, rename, copy_items, move_items, delete_items,
            open_path, reveal,
            search, index_folder, reindex, remove_collection, set_semantic, collections,
            search_apps,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
