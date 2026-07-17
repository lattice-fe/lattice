use std::path::PathBuf;

/// A shortcut shown under "Quick Access" in the sidebar.
#[derive(Debug, Clone)]
pub struct Shortcut {
    pub label: String,
    pub path: PathBuf,
}

/// A mounted drive/volume shown under "This PC".
#[derive(Debug, Clone)]
pub struct Drive {
    /// e.g. "C:" — the label shown before the volume name.
    pub letter: String,
    /// Optional volume name; empty until we query it (later phase).
    pub name: String,
    pub path: PathBuf,
}

impl Drive {
    /// Display string like "Local Disk (C:)" or "(C:)" when unnamed.
    pub fn display(&self) -> String {
        if self.name.is_empty() {
            format!("Local Disk ({})", self.letter)
        } else {
            format!("{} ({})", self.name, self.letter)
        }
    }
}

/// Platform-specific filesystem knowledge. Windows-first, but kept behind this
/// trait so other OSes can be added without touching the UI.
pub trait Platform {
    /// The user's home directory, used as the initial location.
    fn home_dir(&self) -> PathBuf;

    /// Quick-access shortcuts (Desktop, Downloads, Documents, ...).
    fn quick_access(&self) -> Vec<Shortcut>;

    /// Mounted drives / root volumes.
    fn drives(&self) -> Vec<Drive>;
}

/// The active platform implementation for this build.
pub fn current() -> Box<dyn Platform> {
    #[cfg(windows)]
    {
        Box::new(super::windows::WindowsPlatform)
    }
    #[cfg(not(windows))]
    {
        Box::new(UnixPlatform)
    }
}

#[cfg(not(windows))]
pub struct UnixPlatform;

#[cfg(not(windows))]
impl Platform for UnixPlatform {
    fn home_dir(&self) -> PathBuf {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/"))
    }

    fn quick_access(&self) -> Vec<Shortcut> {
        let home = self.home_dir();
        ["Desktop", "Downloads", "Documents", "Pictures", "Music", "Videos"]
            .iter()
            .map(|name| Shortcut {
                label: name.to_string(),
                path: home.join(name),
            })
            .filter(|s| s.path.exists())
            .collect()
    }

    fn drives(&self) -> Vec<Drive> {
        vec![Drive {
            letter: "/".into(),
            name: "Root".into(),
            path: PathBuf::from("/"),
        }]
    }
}
