pub mod help;
pub mod opener;
pub mod render;

#[cfg(test)]
mod tests;

use std::path::{Path, PathBuf};
use lattice_lib::core::index::db::{default_db_path, open_readonly};
use lattice_lib::core::index::search::{
    run_name_search, run_text_search, SearchHit,
};

/// Returns a process exit code: 0 = ok/found, 1 = no results, 2 = error.
pub fn run(args: Vec<String>) -> i32 {
    if args.len() < 2 {
        help::print_help();
        return 0;
    }

    let mut query_tokens: Vec<String> = Vec::new();
    let mut mode = "name"; // "name" | "text" | "semantic" | "preview" | "open" | "reveal"
    let mut limit: usize = 5;
    let mut target_index: Option<usize> = None;
    let mut json = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "-h" | "--help" => { help::print_help(); return 0; }
            "--install" | "install" => { install_cli(); return 0; }
            "-t" | "--text" => mode = "text",
            "-s" | "--semantic" => mode = "semantic",
            "-p" | "--preview" => mode = "preview",
            "-j" | "--json" => json = true,
            "-o" | "--open" => {
                mode = "open";
                if i + 1 < args.len() {
                    if let Ok(idx) = args[i + 1].parse::<usize>() { target_index = Some(idx); i += 1; }
                }
            }
            "-r" | "--reveal" => {
                mode = "reveal";
                if i + 1 < args.len() {
                    if let Ok(idx) = args[i + 1].parse::<usize>() { target_index = Some(idx); i += 1; }
                }
            }
            "-n" | "--limit" => {
                if i + 1 < args.len() {
                    if let Ok(l) = args[i + 1].parse::<usize>() { limit = l; i += 1; }
                }
            }
            _ => query_tokens.push(args[i].clone()),
        }
        i += 1;
    }

    let raw_query = query_tokens.join(" ");
    let query = raw_query.trim();
    if query.is_empty() {
        help::print_help();
        return 0;
    }

    // Spotlight prefixes: = math, ? web, > app
    if let Some(expr) = query.strip_prefix('=') {
        return match eval_math(expr.trim()) {
            Some(val) => { println!("{val}"); 0 }
            None => { eprintln!("Invalid math expression"); 2 }
        };
    }
    if let Some(q) = query.strip_prefix('?') {
        let url = format!("https://www.google.com/search?q={}", urlencoding::encode(q.trim()));
        opener::open_url(&url);
        return 0;
    }
    if let Some(app_name) = query.strip_prefix('>') {
        opener::open_item(Path::new(app_name.trim()));
        return 0;
    }

    // Direct path on disk (absolute or relative) for actions/preview.
    let direct_path = Path::new(query);
    if direct_path.exists() {
        match mode {
            "open" => { opener::open_item(direct_path); return 0; }
            "reveal" => { opener::reveal_in_gui(direct_path); return 0; }
            "preview" => { render::render_preview(direct_path); return 0; }
            _ => {}
        }
    }

    // @kind filter (e.g. @image png, @code main)
    let (search_term, kind_filter) = if let Some(rest) = query.strip_prefix('@') {
        let rest = rest.trim();
        let parts: Vec<&str> = rest.splitn(2, ' ').collect();
        (if parts.len() > 1 { parts[1] } else { "" }, Some(parts[0].to_lowercase()))
    } else {
        (query, None)
    };

    if mode == "preview" {
        let p = Path::new(search_term);
        render::render_preview(p);
        return if p.exists() { 0 } else { 2 };
    }

    // Query the index READ-ONLY — a short-lived reader can never write to (or
    // corrupt) the DB the GUI owns.
    let db_path = default_db_path();
    let index_hits = match open_readonly(&db_path) {
        Ok(conn) => match mode {
            "text" | "semantic" => run_text_search(&conn, search_term, limit * 3).unwrap_or_default(),
            _ => run_name_search(&conn, search_term, limit * 3).unwrap_or_default(),
        },
        Err(_) => Vec::new(),
    };

    let mut hits: Vec<SearchHit> = index_hits
        .into_iter()
        .filter(|h| kind_matches(h, kind_filter.as_deref()))
        .collect();
    // Nothing in the index? Fall back to a recursive filesystem walk of the cwd —
    // covers kinds the index never stores (images, folders) and freshly-added files.
    if hits.is_empty() {
        hits = fallback_file_scan(search_term, kind_filter.as_deref(), limit * 3);
    }

    execute_action_or_render(&hits, query, mode, limit, target_index, json)
}

fn execute_action_or_render(
    hits: &[SearchHit],
    query: &str,
    mode: &str,
    limit: usize,
    target_index: Option<usize>,
    json: bool,
) -> i32 {
    if mode == "open" || mode == "reveal" {
        if hits.is_empty() {
            let path = Path::new(query);
            if path.exists() {
                if mode == "open" { opener::open_item(path); } else { opener::reveal_in_gui(path); }
                return 0;
            }
            eprintln!("No matching files found.");
            return 1;
        }
        let show_count = hits.len().min(limit);
        let selected_idx = if let Some(idx) = target_index {
            idx.saturating_sub(1)
        } else if show_count > 1 && !json {
            render::render_hits(hits, limit);
            use std::io::{self, Write};
            print!("Select item to {mode} [1-{show_count}] (default 1): ");
            io::stdout().flush().ok();
            let mut line = String::new();
            io::stdin().read_line(&mut line).ok();
            line.trim().parse::<usize>().ok().filter(|n| *n >= 1 && *n <= show_count).map_or(0, |n| n - 1)
        } else {
            0 // json or single hit → act on the top result, no prompt
        };
        if let Some(hit) = hits.get(selected_idx) {
            if mode == "open" { opener::open_item(&hit.file_path); } else { opener::reveal_in_gui(&hit.file_path); }
        }
        return 0;
    }

    // search / render modes
    if json {
        print_json(hits, limit);
    } else {
        render::render_hits(hits, limit);
    }
    if hits.is_empty() { 1 } else { 0 }
}

/// Machine-readable output for agents: a JSON array of the top hits.
fn print_json(hits: &[SearchHit], limit: usize) {
    #[derive(serde::Serialize)]
    struct JHit<'a> {
        path: String,
        name: String,
        dir: String,
        is_dir: bool,
        score: f64,
        snippet: &'a str,
    }
    let out: Vec<JHit> = hits
        .iter()
        .take(limit)
        .map(|h| JHit {
            path: h.file_path.to_string_lossy().into_owned(),
            name: h.file_path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
            dir: h.file_path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
            is_dir: h.is_dir,
            score: h.score,
            snippet: h.snippet.trim(),
        })
        .collect();
    println!("{}", serde_json::to_string(&out).unwrap_or_else(|_| "[]".into()));
}

/// Recursive filesystem walk of the cwd (respects .gitignore, skips hidden),
/// filtered by name substring + kind. Used when the index has nothing — which
/// is always the case for kinds the index never stores (images, folders).
fn fallback_file_scan(query: &str, kind: Option<&str>, limit: usize) -> Vec<SearchHit> {
    let q = query.to_lowercase();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut hits = Vec::new();
    for entry in ignore::WalkBuilder::new(&cwd).build().flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
        if !q.is_empty() && !name.contains(&q) {
            continue;
        }
        let hit = SearchHit {
            file_path: path.to_path_buf(),
            is_dir: entry.file_type().is_some_and(|t| t.is_dir()),
            snippet: String::new(),
            score: 1.0,
            char_start: 0,
        };
        if !kind_matches(&hit, kind) {
            continue;
        }
        hits.push(hit);
        if hits.len() >= limit {
            break;
        }
    }
    hits
}

/// Evaluate a basic arithmetic expression (`+ - * / %`, parens, unary minus).
/// Returns the formatted result, or `None` for anything malformed.
fn eval_math(expr: &str) -> Option<String> {
    let s: Vec<u8> = expr.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    if s.is_empty() {
        return None;
    }
    struct P<'a> { b: &'a [u8], i: usize }
    impl<'a> P<'a> {
        fn peek(&self) -> u8 { *self.b.get(self.i).unwrap_or(&0) }
        fn expr(&mut self) -> Option<f64> {
            let mut v = self.term()?;
            loop {
                match self.peek() {
                    b'+' => { self.i += 1; v += self.term()?; }
                    b'-' => { self.i += 1; v -= self.term()?; }
                    _ => break,
                }
            }
            Some(v)
        }
        fn term(&mut self) -> Option<f64> {
            let mut v = self.factor()?;
            loop {
                match self.peek() {
                    b'*' => { self.i += 1; v *= self.factor()?; }
                    b'/' => { self.i += 1; let d = self.factor()?; if d == 0.0 { return None; } v /= d; }
                    b'%' => { self.i += 1; let d = self.factor()?; if d == 0.0 { return None; } v %= d; }
                    _ => break,
                }
            }
            Some(v)
        }
        fn factor(&mut self) -> Option<f64> {
            match self.peek() {
                b'(' => { self.i += 1; let v = self.expr()?; if self.peek() != b')' { return None; } self.i += 1; Some(v) }
                b'-' => { self.i += 1; Some(-self.factor()?) }
                b'+' => { self.i += 1; self.factor() }
                _ => self.number(),
            }
        }
        fn number(&mut self) -> Option<f64> {
            let start = self.i;
            while matches!(self.peek(), b'0'..=b'9' | b'.') { self.i += 1; }
            std::str::from_utf8(self.b.get(start..self.i)?).ok()?.parse().ok()
        }
    }
    let mut p = P { b: &s, i: 0 };
    let v = p.expr()?;
    if p.i != s.len() {
        return None; // trailing garbage → not valid math
    }
    if v.fract() == 0.0 && v.abs() < 1e15 {
        Some(format!("{}", v as i64))
    } else {
        Some(format!("{v}"))
    }
}

/// Whether a hit satisfies an optional `@kind` filter.
fn kind_matches(h: &SearchHit, kind: Option<&str>) -> bool {
    let Some(kf) = kind else { return true };
    if kf == "folder" || kf == "dir" {
        return h.is_dir;
    }
    let ext = h.file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    match kf {
        "image" | "img" => ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"].contains(&ext.as_str()),
        "audio" => ["mp3", "wav", "ogg", "flac", "m4a", "aac"].contains(&ext.as_str()),
        "video" => ["mp4", "mkv", "mov", "avi", "webm"].contains(&ext.as_str()),
        "code" => ["rs", "js", "ts", "jsx", "tsx", "py", "c", "cpp", "h", "go", "java", "css", "html", "json", "yaml"].contains(&ext.as_str()),
        "doc" | "document" => ["pdf", "md", "txt", "docx", "xlsx", "pptx"].contains(&ext.as_str()),
        "archive" => ["zip", "tar", "gz", "7z", "rar"].contains(&ext.as_str()),
        other => ext == other,
    }
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        s.replace(' ', "+")
    }
}

pub fn install_cli() {
    let current_exe = std::env::current_exe();
    let Ok(exe_path) = current_exe else {
        eprintln!("\x1b[38;2;245;158;11mError: Could not determine current executable path\x1b[0m");
        return;
    };

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let win_apps_dir = std::path::PathBuf::from(local_app_data).join("Microsoft").join("WindowsApps");
            if win_apps_dir.exists() {
                let target_lat = win_apps_dir.join("lat.exe");
                let target_cli = win_apps_dir.join("lattice-cli.exe");

                let _ = std::fs::copy(&exe_path, &target_lat);

                if let Some(parent) = exe_path.parent() {
                    let alias_src = parent.join("lattice-cli.exe");
                    if alias_src.exists() {
                        let _ = std::fs::copy(&alias_src, &target_cli);
                    } else {
                        let _ = std::fs::copy(&exe_path, &target_cli);
                    }
                }

                println!("\x1b[38;2;20;184;166m✓ Installed lat.exe & lattice-cli.exe to {}\x1b[0m", win_apps_dir.display());
                println!("\x1b[38;2;245;158;11mYou can now run 'lat' directly from any terminal window!\x1b[0m");
                return;
            }
        }
    }

    println!("\x1b[38;2;20;184;166mCLI binary located at: {}\x1b[0m", exe_path.display());
}
