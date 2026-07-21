use std::fs;
use std::path::{Path, PathBuf};

/// What a pending clipboard action will do when pasted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClipboardMode {
    Copy,
    Cut,
}

/// An internal (app-local) clipboard holding paths to copy or move. Not yet
/// wired to the OS clipboard — that's a later phase.
#[derive(Debug, Clone)]
pub struct Clipboard {
    pub paths: Vec<PathBuf>,
    pub mode: ClipboardMode,
}

/// Build a destination path inside `dir` for `name`, appending " - Copy" (and
/// then " (2)", " (3)", ...) until the path is free, matching Explorer.
fn unique_dest(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(name)
        .to_string();
    let ext = path.extension().and_then(|e| e.to_str());

    let with = |suffix: String| -> PathBuf {
        let filename = match ext {
            Some(e) => format!("{stem}{suffix}.{e}"),
            None => format!("{stem}{suffix}"),
        };
        dir.join(filename)
    };

    let first = with(" - Copy".to_string());
    if !first.exists() {
        return first;
    }
    for n in 2..10_000 {
        let candidate = with(format!(" - Copy ({n})"));
        if !candidate.exists() {
            return candidate;
        }
    }
    // Extremely unlikely fallback.
    dir.join(format!("{name} - Copy"))
}

fn file_name_of(path: &Path) -> Result<String, String> {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Invalid path: {}", path.display()))
}

/// Recursively copy `src` (file or directory) to the exact path `dst`.
fn copy_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    let meta =
        fs::symlink_metadata(src).map_err(|e| format!("{}: {e}", src.display()))?;
    if meta.is_dir() {
        fs::create_dir_all(dst).map_err(|e| format!("{}: {e}", dst.display()))?;
        for entry in fs::read_dir(src).map_err(|e| format!("{}: {e}", src.display()))? {
            let entry = entry.map_err(|e| e.to_string())?;
            let child_dst = dst.join(entry.file_name());
            copy_recursive(&entry.path(), &child_dst)?;
        }
        Ok(())
    } else {
        fs::copy(src, dst)
            .map(|_| ())
            .map_err(|e| format!("{}: {e}", src.display()))
    }
}

/// True if `dest_dir` is the source directory itself or lives somewhere inside
/// it. Pasting/moving a folder into its own subtree would recurse forever, so
/// callers must reject it. Paths are canonicalized first so `.`/`..` and case
/// differences don't slip past the check.
fn is_inside(src: &Path, dest_dir: &Path) -> bool {
    if !src.is_dir() {
        return false;
    }
    match (src.canonicalize(), dest_dir.canonicalize()) {
        (Ok(s), Ok(d)) => d.starts_with(&s),
        _ => false,
    }
}

fn reject_recursive(src: &Path, dest_dir: &Path) -> Result<(), String> {
    if is_inside(src, dest_dir) {
        let name = file_name_of(src)?;
        Err(format!(
            "Can't place \"{name}\" inside itself — the destination is within the source folder"
        ))
    } else {
        Ok(())
    }
}

/// Copy each source into `dest_dir`, giving colliding names a " - Copy" suffix.
pub fn copy_into(sources: &[PathBuf], dest_dir: &Path) -> Result<(), String> {
    for src in sources {
        reject_recursive(src, dest_dir)?;
        let name = file_name_of(src)?;
        let dst = unique_dest(dest_dir, &name);
        copy_recursive(src, &dst)?;
    }
    Ok(())
}

/// Move each source into `dest_dir`. Uses a rename when possible and falls back
/// to copy-then-delete across volumes. Skips items already in `dest_dir`.
pub fn move_into(sources: &[PathBuf], dest_dir: &Path) -> Result<(), String> {
    for src in sources {
        reject_recursive(src, dest_dir)?;
        let name = file_name_of(src)?;
        if src.parent() == Some(dest_dir) {
            continue; // already here
        }
        let dst = unique_dest(dest_dir, &name);
        match fs::rename(src, &dst) {
            Ok(()) => {}
            Err(_) => {
                // Likely a cross-volume move: copy then remove the original.
                copy_recursive(src, &dst)?;
                remove_recursive(src)?;
            }
        }
    }
    Ok(())
}

fn remove_recursive(path: &Path) -> Result<(), String> {
    let meta =
        fs::symlink_metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if meta.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
    .map_err(|e| format!("{}: {e}", path.display()))
}

/// Rename `path` to `new_name` within the same parent directory.
pub fn rename(path: &Path, new_name: &str) -> Result<PathBuf, String> {
    let new_name = new_name.trim();
    if new_name.is_empty() {
        return Err("Name can't be empty".to_string());
    }
    if new_name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
        return Err("A name can't contain \\ / : * ? \" < > |".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "Can't rename this item".to_string())?;
    let dst = parent.join(new_name);
    if dst == path {
        return Ok(dst);
    }
    if dst.exists() {
        return Err(format!("An item named \"{new_name}\" already exists"));
    }
    fs::rename(path, &dst).map_err(|e| e.to_string())?;
    Ok(dst)
}

/// Create a new folder in `dir`, picking a free "New folder"/"New folder (n)"
/// name. Returns the created path.
pub fn create_folder(dir: &Path) -> Result<PathBuf, String> {
    let mut target = dir.join("New folder");
    if target.exists() {
        let mut n = 2;
        loop {
            target = dir.join(format!("New folder ({n})"));
            if !target.exists() {
                break;
            }
            n += 1;
        }
    }
    fs::create_dir(&target).map_err(|e| e.to_string())?;
    Ok(target)
}

/// Send the given paths to the Recycle Bin (recoverable, not a permanent delete).
pub fn delete_to_trash(paths: &[PathBuf]) -> Result<(), String> {
    trash::delete_all(paths).map_err(|e| e.to_string())
}

// --- async wrappers (run on a blocking thread so the UI stays responsive) ---

async fn blocking<F>(f: F) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String> + Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| format!("operation failed: {e}"))?
}

pub async fn copy_into_async(sources: Vec<PathBuf>, dest_dir: PathBuf) -> Result<(), String> {
    blocking(move || copy_into(&sources, &dest_dir)).await
}

pub async fn move_into_async(sources: Vec<PathBuf>, dest_dir: PathBuf) -> Result<(), String> {
    blocking(move || move_into(&sources, &dest_dir)).await
}

pub async fn delete_to_trash_async(paths: Vec<PathBuf>) -> Result<(), String> {
    blocking(move || delete_to_trash(&paths)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// A unique temporary directory that cleans itself up on drop, so tests
    /// stay isolated even if the machine's temp dir is shared.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> TempDir {
            let n = COUNTER.fetch_add(1, Ordering::Relaxed);
            let mut p = std::env::temp_dir();
            p.push(format!("lattice-test-{}-{}", std::process::id(), n));
            fs::create_dir_all(&p).unwrap();
            TempDir(p)
        }
        fn path(&self) -> &Path {
            &self.0
        }
        fn file(&self, name: &str, contents: &str) -> PathBuf {
            let p = self.0.join(name);
            fs::write(&p, contents).unwrap();
            p
        }
        fn dir(&self, name: &str) -> PathBuf {
            let p = self.0.join(name);
            fs::create_dir_all(&p).unwrap();
            p
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn create_folder_picks_unique_names() {
        let tmp = TempDir::new();
        let a = create_folder(tmp.path()).unwrap();
        assert_eq!(a.file_name().unwrap(), "New folder");
        let b = create_folder(tmp.path()).unwrap();
        assert_eq!(b.file_name().unwrap(), "New folder (2)");
        let c = create_folder(tmp.path()).unwrap();
        assert_eq!(c.file_name().unwrap(), "New folder (3)");
    }

    #[test]
    fn rename_moves_the_file() {
        let tmp = TempDir::new();
        let a = tmp.file("a.txt", "hi");
        let renamed = rename(&a, "b.txt").unwrap();
        assert!(renamed.exists());
        assert!(!a.exists());
        assert_eq!(fs::read_to_string(&renamed).unwrap(), "hi");
    }

    #[test]
    fn rename_rejects_bad_names() {
        let tmp = TempDir::new();
        let a = tmp.file("a.txt", "x");
        assert!(rename(&a, "").is_err());
        assert!(rename(&a, "   ").is_err());
        assert!(rename(&a, "bad/name").is_err());
        assert!(rename(&a, "q?.txt").is_err());
        // The original is untouched after failed renames.
        assert!(a.exists());
    }

    #[test]
    fn rename_rejects_existing_target() {
        let tmp = TempDir::new();
        let a = tmp.file("a.txt", "1");
        tmp.file("b.txt", "2");
        assert!(rename(&a, "b.txt").is_err());
        assert!(a.exists());
    }

    #[test]
    fn copy_file_then_collision_gets_copy_suffix() {
        let tmp = TempDir::new();
        let src = tmp.dir("src");
        let dst = tmp.dir("dst");
        let file = src.join("a.txt");
        fs::write(&file, "data").unwrap();

        copy_into(&[file.clone()], &dst).unwrap();
        assert!(dst.join("a.txt").exists());
        // The original is left in place (copy, not move).
        assert!(file.exists());

        copy_into(&[file.clone()], &dst).unwrap();
        assert!(dst.join("a - Copy.txt").exists());

        copy_into(&[file], &dst).unwrap();
        assert!(dst.join("a - Copy (2).txt").exists());
    }

    #[test]
    fn copy_directory_is_recursive() {
        let tmp = TempDir::new();
        let src = tmp.dir("proj");
        fs::create_dir_all(src.join("nested")).unwrap();
        fs::write(src.join("nested/deep.txt"), "z").unwrap();
        let dst = tmp.dir("out");

        copy_into(&[src], &dst).unwrap();
        assert_eq!(
            fs::read_to_string(dst.join("proj/nested/deep.txt")).unwrap(),
            "z"
        );
    }

    #[test]
    fn move_relocates_and_removes_original() {
        let tmp = TempDir::new();
        let src = tmp.dir("from");
        let dst = tmp.dir("to");
        let file = src.join("m.txt");
        fs::write(&file, "move me").unwrap();

        move_into(&[file.clone()], &dst).unwrap();
        assert!(dst.join("m.txt").exists());
        assert!(!file.exists());
    }

    #[test]
    fn move_into_same_dir_is_a_noop() {
        let tmp = TempDir::new();
        let file = tmp.file("keep.txt", "x");
        move_into(&[file.clone()], tmp.path()).unwrap();
        // Still exactly where it was, no " - Copy" duplicate created.
        assert!(file.exists());
        assert!(!tmp.path().join("keep - Copy.txt").exists());
    }

    #[test]
    fn cannot_paste_folder_into_itself_or_a_subfolder() {
        let tmp = TempDir::new();
        let folder = tmp.dir("A");
        fs::write(folder.join("f.txt"), "x").unwrap();
        let sub = tmp.dir("A/sub");

        // Into itself.
        assert!(copy_into(&[folder.clone()], &folder).is_err());
        assert!(move_into(&[folder.clone()], &folder).is_err());
        // Into a descendant.
        assert!(copy_into(&[folder.clone()], &sub).is_err());
        assert!(move_into(&[folder.clone()], &sub).is_err());

        // The source is left completely intact (no partial nested copies).
        assert!(folder.join("f.txt").exists());
        assert!(!folder.join("A").exists());

        // Sanity: copying into a sibling still works.
        let dst = tmp.dir("B");
        assert!(copy_into(&[folder], &dst).is_ok());
        assert!(dst.join("A/f.txt").exists());
    }

    #[test]
    fn unique_dest_handles_names_with_and_without_extension() {
        let tmp = TempDir::new();
        // No collision -> exact name.
        assert_eq!(unique_dest(tmp.path(), "fresh.txt"), tmp.path().join("fresh.txt"));

        fs::write(tmp.path().join("doc.pdf"), "x").unwrap();
        assert_eq!(
            unique_dest(tmp.path(), "doc.pdf"),
            tmp.path().join("doc - Copy.pdf")
        );

        fs::create_dir(tmp.path().join("folder")).unwrap();
        assert_eq!(
            unique_dest(tmp.path(), "folder"),
            tmp.path().join("folder - Copy")
        );
    }

    #[test]
    #[ignore = "sends a real file to the Recycle Bin; run with `cargo test -- --ignored`"]
    fn delete_sends_to_recycle_bin() {
        let tmp = TempDir::new();
        let file = tmp.file("trash-me.txt", "bye");
        delete_to_trash(&[file.clone()]).unwrap();
        assert!(!file.exists());
    }
}
