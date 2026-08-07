use std::path::Path;
use std::process::Command;

pub fn open_item(path: &Path) {
    if !path.exists() {
        eprintln!("\x1b[38;2;245;158;11mError: Path does not exist - {}\x1b[0m", path.display());
        return;
    }

    if path.is_dir() {
        open_in_lattice(path);
    } else {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("cmd")
                .args(["/c", "start", "", &path.to_string_lossy()])
                .spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("open").arg(path).spawn();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("xdg-open").arg(path).spawn();
        }
        println!("\x1b[38;2;20;184;166mOpened {}\x1b[0m", path.display());
    }
}

pub fn open_in_lattice(path: &Path) {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let path_str = canonical.to_string_lossy();
    println!("\x1b[38;2;20;184;166mOpening in Lattice GUI: {}\x1b[0m", path_str);

    let current_exe = std::env::current_exe().ok();
    let exe_dir = current_exe.as_ref().and_then(|p| p.parent());

    let mut candidates = Vec::new();

    if let Some(dir) = exe_dir {
        candidates.push(dir.join("lattice.exe"));
        candidates.push(dir.join("Lattice.exe"));
    }

    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let p = std::path::PathBuf::from(&local);
        candidates.push(p.join("Programs").join("Lattice").join("Lattice.exe"));
        candidates.push(p.join("Programs").join("Lattice").join("lattice.exe"));
        candidates.push(p.join("Lattice").join("Lattice.exe"));
    }

    if let Ok(pf) = std::env::var("ProgramFiles") {
        let p = std::path::PathBuf::from(&pf);
        candidates.push(p.join("Lattice").join("Lattice.exe"));
    }

    // Dev build paths
    candidates.push(std::path::PathBuf::from(r"D:\dev\lattice\app\src-tauri\target\debug\lattice.exe"));
    candidates.push(std::path::PathBuf::from(r"D:\dev\lattice\app\src-tauri\target\release\lattice.exe"));

    for candidate in candidates {
        if candidate.exists() {
            if Command::new(&candidate).arg(&*path_str).spawn().is_ok() {
                return;
            }
        }
    }

    // Try system PATH
    if Command::new("lattice").arg(&*path_str).spawn().is_ok() {
        return;
    }
    if Command::new("Lattice").arg(&*path_str).spawn().is_ok() {
        return;
    }

    // Final fallback if Lattice GUI is not found
    #[cfg(target_os = "windows")]
    let _ = Command::new("cmd").args(["/c", "start", "", &*path_str]).spawn();
}

pub fn reveal_in_gui(path: &Path) {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let target = if canonical.is_dir() {
        canonical
    } else {
        canonical.parent().map(|p| p.to_path_buf()).unwrap_or(canonical)
    };
    println!("\x1b[38;2;20;184;166mRevealing in Lattice: {}\x1b[0m", path.display());
    open_in_lattice(&target);
}

pub fn open_url(url: &str) {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/c", "start", "", url])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(url).spawn();
    }
    println!("\x1b[38;2;20;184;166mOpened URL: {}\x1b[0m", url);
}
