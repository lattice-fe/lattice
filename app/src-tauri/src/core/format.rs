use std::time::SystemTime;

use chrono::{DateTime, Local};

/// Human-readable file size, roughly matching Explorer's "Size" column, which
/// reports in whole KB for anything ≥ 1 KB.
pub fn size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;

    if bytes < KB {
        format!("{bytes} B")
    } else if bytes < MB {
        format!("{} KB", div_ceil(bytes, KB))
    } else if bytes < GB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes < TB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else {
        format!("{:.1} TB", bytes as f64 / TB as f64)
    }
}

fn div_ceil(a: u64, b: u64) -> u64 {
    (a + b - 1) / b
}

/// Format a modification time as "yyyy-MM-dd HH:mm" in local time.
pub fn datetime(time: Option<SystemTime>) -> String {
    match time {
        Some(t) => {
            let dt: DateTime<Local> = t.into();
            dt.format("%Y-%m-%d %H:%M").to_string()
        }
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sizes() {
        assert_eq!(size(0), "0 B");
        assert_eq!(size(512), "512 B");
        assert_eq!(size(1024), "1 KB");
        assert_eq!(size(1500), "2 KB"); // rounds up like Explorer
        assert_eq!(size(1024 * 1024), "1.0 MB");
        assert_eq!(size(3 * 1024 * 1024 * 1024), "3.0 GB");
    }
}
