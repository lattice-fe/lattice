use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use ignore::WalkBuilder;

/// Size caps: skip files larger than these (text is small; PDFs can be bigger).
pub const MAX_TEXT_BYTES: u64 = 5 * 1024 * 1024;
pub const MAX_PDF_BYTES: u64 = 50 * 1024 * 1024;

/// Directory names we always prune, even if not gitignored.
const PRUNED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    ".idea",
    ".vscode",
];

/// How a discovered file's text will be extracted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocKind {
    Text,
    Pdf,
}

impl DocKind {
    pub fn size_cap(self) -> u64 {
        match self {
            DocKind::Text => MAX_TEXT_BYTES,
            DocKind::Pdf => MAX_PDF_BYTES,
        }
    }
}

/// Extensions we treat as extractable text (code / plain text / markdown /
/// data / docs). PDF is handled separately.
const TEXT_EXTS: &[&str] = &[
    // code
    "rs", "c", "cc", "cpp", "cxx", "h", "hpp", "py", "js", "jsx", "ts", "tsx", "go", "java",
    "kt", "kts", "cs", "rb", "php", "swift", "scala", "sh", "bash", "zsh", "ps1", "lua", "pl",
    "r", "dart", "ex", "exs", "hs", "clj", "sql", "vim",
    // web / markup
    "html", "htm", "css", "scss", "sass", "less", "xml", "svg", "vue", "svelte",
    // data / config
    "json", "jsonc", "toml", "yaml", "yml", "ini", "cfg", "conf", "env", "properties", "csv",
    "tsv",
    // text / docs
    "txt", "text", "log", "md", "markdown", "rst", "org", "adoc", "tex",
];

/// Classify a path by extension, or `None` if it isn't an indexable type.
pub fn classify(path: &Path) -> Option<DocKind> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    if ext == "pdf" {
        Some(DocKind::Pdf)
    } else if TEXT_EXTS.contains(&ext.as_str()) {
        Some(DocKind::Text)
    } else {
        None
    }
}

/// A file discovered under a collection root that is eligible for indexing.
#[derive(Debug, Clone)]
pub struct Found {
    pub path: PathBuf,
    pub kind: DocKind,
    pub size: u64,
    /// Modification time as whole seconds since the Unix epoch.
    pub mtime: i64,
}

/// Walk `root` (respecting `.gitignore`, pruning heavy dirs and hidden files),
/// yielding indexable files within the size caps.
pub fn discover(root: &Path) -> Vec<Found> {
    let mut out = Vec::new();

    let walk = WalkBuilder::new(root)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .hidden(true) // skip hidden/dotfiles
        .filter_entry(|entry| {
            // Prune well-known heavy directories by name.
            let name = entry.file_name().to_string_lossy();
            !PRUNED_DIRS.contains(&name.as_ref())
        })
        .build();

    for result in walk {
        let Ok(entry) = result else { continue };
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let path = entry.path();
        let Some(kind) = classify(path) else { continue };
        let Ok(meta) = entry.metadata() else { continue };
        let size = meta.len();
        if size == 0 || size > kind.size_cap() {
            continue;
        }
        out.push(Found {
            path: path.to_path_buf(),
            kind,
            size,
            mtime: mtime_secs(&meta),
        });
    }

    out
}

/// Walk `root` and yield its sub-directories as `(path, mtime)` — recorded as
/// name-searchable entries with no content. Same prune/hidden rules as
/// [`discover`]; the root itself is skipped.
pub fn discover_dirs(root: &Path) -> Vec<(PathBuf, i64)> {
    let mut out = Vec::new();
    let walk = WalkBuilder::new(root)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .hidden(true)
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            !PRUNED_DIRS.contains(&name.as_ref())
        })
        .build();
    for result in walk {
        let Ok(entry) = result else { continue };
        if !entry.file_type().is_some_and(|t| t.is_dir()) {
            continue;
        }
        let path = entry.path();
        if path == root {
            continue;
        }
        let mtime = entry.metadata().ok().map(|m| mtime_secs(&m)).unwrap_or(0);
        out.push((path.to_path_buf(), mtime));
    }
    out
}

fn mtime_secs(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn classify_by_extension() {
        assert_eq!(classify(&PathBuf::from("a.rs")), Some(DocKind::Text));
        assert_eq!(classify(&PathBuf::from("A.MD")), Some(DocKind::Text));
        assert_eq!(classify(&PathBuf::from("doc.pdf")), Some(DocKind::Pdf));
        assert_eq!(classify(&PathBuf::from("photo.png")), None);
        assert_eq!(classify(&PathBuf::from("noext")), None);
        assert_eq!(classify(&PathBuf::from("archive.zip")), None);
    }

    #[test]
    fn discover_finds_text_skips_binary_and_pruned() {
        let tmp = std::env::temp_dir().join(format!("lattice-walk-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("node_modules")).unwrap();
        std::fs::write(tmp.join("keep.rs"), "fn main() {}").unwrap();
        std::fs::write(tmp.join("notes.md"), "# hi").unwrap();
        std::fs::write(tmp.join("image.png"), [0u8, 1, 2, 3]).unwrap();
        std::fs::write(tmp.join("node_modules/dep.js"), "x").unwrap();

        let found = discover(&tmp);
        let names: Vec<String> = found
            .iter()
            .map(|f| f.path.file_name().unwrap().to_string_lossy().into_owned())
            .collect();

        assert!(names.contains(&"keep.rs".to_string()));
        assert!(names.contains(&"notes.md".to_string()));
        assert!(!names.iter().any(|n| n == "image.png"));
        assert!(!names.iter().any(|n| n == "dep.js")); // pruned dir

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
