pub mod core;

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri_plugin_opener::OpenerExt;

use core::fs::entry::{Entry, EntryKind};
use core::fs::{ops, platform, scan};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_dir,
            drives,
            quick_access,
            home_dir,
            new_folder,
            rename,
            copy_items,
            move_items,
            delete_items,
            open_path,
            reveal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
