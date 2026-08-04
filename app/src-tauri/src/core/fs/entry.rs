use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// A broad category for a filesystem entry, used to pick an icon and to fill
/// the "Type" column. Derived from the extension (or the fact that it's a dir).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryKind {
    Folder,
    Drive,
    Image,
    Audio,
    Video,
    Archive,
    Document,
    Code,
    Executable,
    Other,
}

impl EntryKind {
    /// A human-readable label for the "Type" column.
    pub fn label(self, ext: Option<&str>) -> String {
        match self {
            EntryKind::Folder => "File folder".to_string(),
            EntryKind::Drive => "Local Disk".to_string(),
            _ => match ext {
                Some(e) if !e.is_empty() => format!("{} file", e.to_uppercase()),
                _ => "File".to_string(),
            },
        }
    }

    fn from_extension(ext: &str) -> EntryKind {
        // Lowercased extension without the dot.
        match ext {
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "svg" | "ico" | "tiff" | "tif" => {
                EntryKind::Image
            }
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" => EntryKind::Audio,
            "mp4" | "mkv" | "avi" | "mov" | "wmv" | "webm" | "flv" | "m4v" => EntryKind::Video,
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "zst" | "cab" => {
                EntryKind::Archive
            }
            "txt" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "md" | "rtf"
            | "odt" | "csv" | "markdown" | "mdx" => EntryKind::Document,
            // Code files (synchronized with frontend PREVIEW_EXTS)
            "rs" | "c" | "cpp" | "h" | "hpp" | "py" | "js" | "ts" | "jsx" | "tsx" | "mjs" | "cjs"
            | "go" | "java" | "cs" | "rb" | "php" | "html" | "htm" | "css" | "scss" | "sass"
            | "less" | "styl" | "json" | "toml" | "yaml" | "yml" | "xml" | "sh" | "bash"
            | "zsh" | "lua" | "swift" | "kt" | "r" | "scala" | "pl" | "pm" | "vim" | "sql"
            | "graphql" | "prisma" | "proto" | "ex" | "exs" | "erl" | "hrl" | "ini" | "cfg"
            | "conf" | "log" | "gitignore" | "dockerignore" | "env" | "dockerfile" | "makefile" => {
                EntryKind::Code
            }
            "exe" | "msi" | "bat" | "cmd" | "com" | "scr" => EntryKind::Executable,
            _ => EntryKind::Other,
        }
    }
}

/// A single filesystem entry displayed in the file list or sidebar.
#[derive(Debug, Clone)]
pub struct Entry {
    pub path: PathBuf,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<SystemTime>,
    pub kind: EntryKind,
    pub hidden: bool,
}

impl Entry {
    /// The lowercase extension without the leading dot, if any.
    pub fn extension(&self) -> Option<String> {
        if self.is_dir {
            return None;
        }
        self.path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
    }

    /// The "Type" column label for this entry.
    pub fn type_label(&self) -> String {
        self.kind.label(self.extension().as_deref())
    }
}

/// Classify a path into an [`EntryKind`] given whether it is a directory.
pub fn classify(path: &Path, is_dir: bool) -> EntryKind {
    if is_dir {
        return EntryKind::Folder;
    }

    // Check extension first
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        return EntryKind::from_extension(&ext.to_ascii_lowercase());
    }

    // For files without extensions, check if the filename matches known patterns
    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
        let lower = filename.to_ascii_lowercase();
        match lower.as_str() {
            ".gitignore" | ".dockerignore" | ".env" | ".gitattributes" | ".editorconfig"
            | ".prettierrc" | ".eslintrc" | ".babelrc" | "dockerfile" | "makefile"
            | ".npmrc" | ".yarnrc" | ".nvmrc" => return EntryKind::Code,
            _ => {}
        }
    }

    EntryKind::Other
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn classifies_by_extension() {
        assert_eq!(classify(&PathBuf::from("a.PNG"), false), EntryKind::Image);
        assert_eq!(classify(&PathBuf::from("a.rs"), false), EntryKind::Code);
        assert_eq!(classify(&PathBuf::from("a.zip"), false), EntryKind::Archive);
        assert_eq!(classify(&PathBuf::from("a.exe"), false), EntryKind::Executable);
        assert_eq!(classify(&PathBuf::from("noext"), false), EntryKind::Other);
        assert_eq!(classify(&PathBuf::from("folder"), true), EntryKind::Folder);
    }

    #[test]
    fn type_label_uses_uppercased_ext() {
        let e = Entry {
            path: PathBuf::from("photo.jpg"),
            name: "photo.jpg".into(),
            is_dir: false,
            size: 10,
            modified: None,
            kind: EntryKind::Image,
            hidden: false,
        };
        assert_eq!(e.type_label(), "JPG file");
    }
}
