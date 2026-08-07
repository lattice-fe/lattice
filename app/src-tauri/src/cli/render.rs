use std::fs;
use std::path::Path;
use lattice_lib::core::index::search::SearchHit;

const AMBER: &str = "\x1b[38;2;245;158;11m";
const TEAL: &str = "\x1b[38;2;20;184;166m";
const DIM: &str = "\x1b[38;2;113;113;122m";
const BOLD: &str = "\x1b[1m";
const RESET: &str = "\x1b[0m";

pub fn render_hits(hits: &[SearchHit], limit: usize) {
    if hits.is_empty() {
        println!("{DIM}No matching files found.{RESET}");
        return;
    }

    let show_count = hits.len().min(limit);
    println!("{BOLD}{AMBER}Found {} results (showing top {}):{RESET}\n", hits.len(), show_count);

    for (idx, hit) in hits.iter().take(show_count).enumerate() {
        let file_name = hit.file_path.file_name().unwrap_or_default().to_string_lossy();
        let parent_dir = hit.file_path.parent().map(|p| p.to_string_lossy()).unwrap_or_default();
        let icon = if hit.is_dir { "📁" } else { "📄" };

        println!(
            "{BOLD}{AMBER}[{}]{RESET} {} {BOLD}{}{RESET} {DIM}({}){RESET}",
            idx + 1,
            icon,
            file_name,
            parent_dir
        );

        if !hit.snippet.trim().is_empty() {
            let clean_snip = hit.snippet.trim().replace('\n', " ");
            let snip_display = if clean_snip.len() > 120 {
                format!("{}...", &clean_snip[..120])
            } else {
                clean_snip
            };
            println!("    {TEAL}{}{RESET}", snip_display);
        }
        println!();
    }
}

pub fn render_preview(path: &Path) {
    if !path.exists() {
        eprintln!("{AMBER}Error: File not found - {}{RESET}", path.display());
        return;
    }

    if path.is_dir() {
        println!("{BOLD}{AMBER}Directory: {}{RESET}\n", path.display());
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_d = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                println!("  {} {}", if is_d { "📁" } else { "📄" }, name);
            }
        }
        return;
    }

    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => {
            println!("{DIM}[Binary or non-UTF8 file - cannot preview text]{RESET}");
            return;
        }
    };

    println!("{BOLD}{AMBER}Previewing: {}{RESET}\n", path.display());
    let keywords = [
        "fn", "let", "const", "pub", "struct", "enum", "impl", "use",
        "import", "export", "function", "return", "class", "if", "else"
    ];

    for (idx, line) in content.lines().enumerate().take(300) {
        let mut highlighted = line.to_string();
        for kw in &keywords {
            let target = format!(" {kw} ");
            let replacement = format!(" {AMBER}{kw}{RESET} ");
            highlighted = highlighted.replace(&target, &replacement);
        }
        println!("{DIM}{:4} |{RESET} {}", idx + 1, highlighted);
    }

    let total_lines = content.lines().count();
    if total_lines > 300 {
        println!("\n{DIM}... (showing 300 of {} lines){RESET}", total_lines);
    }
}
