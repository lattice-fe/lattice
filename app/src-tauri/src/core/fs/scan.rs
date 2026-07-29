use std::fs;
use std::path::{Path, PathBuf};

use super::entry::{classify, Entry};

/// Read the contents of a directory into a list of [`Entry`]. This is a
/// blocking call (touches the filesystem for every child's metadata) and is
/// meant to be run off the UI thread via `Task::perform` + `spawn_blocking`.
pub fn scan_dir(path: &Path) -> Result<Vec<Entry>, String> {
    let read = fs::read_dir(path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            "You don't have permission to open this folder.".to_string()
        } else {
            format!("Can't open {}: {e}", path.display())
        }
    })?;

    let mut entries = Vec::new();
    for item in read {
        let item = match item {
            Ok(i) => i,
            Err(_) => continue, // skip entries we can't stat
        };
        let child = item.path();
        let name = item
            .file_name()
            .to_string_lossy()
            .into_owned();

        // Use the DirEntry's file_type when possible; fall back to a stat.
        let (is_dir, metadata) = match item.file_type() {
            Ok(ft) => (ft.is_dir(), item.metadata().ok()),
            Err(_) => {
                let md = fs::metadata(&child).ok();
                (md.as_ref().map(|m| m.is_dir()).unwrap_or(false), md)
            }
        };

        let size = if is_dir {
            0
        } else {
            metadata.as_ref().map(|m| m.len()).unwrap_or(0)
        };
        let modified = metadata.as_ref().and_then(|m| m.modified().ok());
        let hidden = metadata
            .as_ref()
            .map(|m| is_hidden(&name, m))
            .unwrap_or(false);

        entries.push(Entry {
            kind: classify(&child, is_dir),
            path: child,
            name,
            is_dir,
            size,
            modified,
            hidden,
        });
    }

    Ok(entries)
}

/// List only the subdirectories of a path (for the sidebar tree), sorted by
/// name case-insensitively.
pub fn scan_subdirs(path: &Path) -> Result<Vec<Entry>, String> {
    let mut dirs: Vec<Entry> = scan_dir(path)?.into_iter().filter(|e| e.is_dir).collect();
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(dirs)
}

#[cfg(windows)]
fn is_hidden(_name: &str, md: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
    let attrs = md.file_attributes();
    attrs & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM) != 0
}

#[cfg(not(windows))]
fn is_hidden(name: &str, _md: &fs::Metadata) -> bool {
    name.starts_with('.')
}

/// Async wrapper around [`scan_dir`] that runs on a blocking thread so a large
/// directory never stalls the UI.
pub async fn scan_dir_async(path: PathBuf) -> Result<Vec<Entry>, String> {
    tokio::task::spawn_blocking(move || scan_dir(&path))
        .await
        .map_err(|e| format!("scan task failed: {e}"))?
}

/// Async wrapper around [`scan_subdirs`].
pub async fn scan_subdirs_async(path: PathBuf) -> Result<Vec<Entry>, String> {
    tokio::task::spawn_blocking(move || scan_subdirs(&path))
        .await
        .map_err(|e| format!("scan task failed: {e}"))?
}
