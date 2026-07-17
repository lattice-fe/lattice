#![cfg(windows)]

use std::path::PathBuf;

use super::platform::{Drive, Platform, Shortcut};

pub struct WindowsPlatform;

impl WindowsPlatform {
    fn user_profile() -> PathBuf {
        std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .or_else(|| {
                match (std::env::var_os("HOMEDRIVE"), std::env::var_os("HOMEPATH")) {
                    (Some(d), Some(p)) => {
                        let mut base = PathBuf::from(d);
                        base.push(p);
                        Some(base)
                    }
                    _ => None,
                }
            })
            .unwrap_or_else(|| PathBuf::from("C:\\"))
    }
}

impl Platform for WindowsPlatform {
    fn home_dir(&self) -> PathBuf {
        Self::user_profile()
    }

    fn quick_access(&self) -> Vec<Shortcut> {
        let home = Self::user_profile();
        // Standard user folders. We probe existence so we don't show dead links.
        [
            "Desktop",
            "Downloads",
            "Documents",
            "Pictures",
            "Music",
            "Videos",
        ]
        .iter()
        .map(|name| Shortcut {
            label: name.to_string(),
            path: home.join(name),
        })
        .filter(|s| s.path.exists())
        .collect()
    }

    fn drives(&self) -> Vec<Drive> {
        // Probe A:\ .. Z:\ for existence. Avoids winapi; volume labels come later.
        let mut drives = Vec::new();
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            let path = PathBuf::from(&root);
            if path.exists() {
                drives.push(Drive {
                    letter: format!("{}:", letter as char),
                    name: String::new(),
                    path,
                });
            }
        }
        drives
    }
}
