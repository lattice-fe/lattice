use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::{Duration, Instant};

pub const BASE_URL: &str = "http://127.0.0.1:8765";
const PORT: &str = "8765";
const PRINCIPAL: &str = "lattice-local";

/// Owns the RAG sidecar (the vendored `index` FastAPI app) child process for
/// the app's lifetime, and shuts it down on drop.
pub struct Sidecar {
    child: Option<Child>,
    /// Windows Job Object: any spawned child is force-killed if this process
    /// dies — even on a crash that skips `shutdown` — so sidecars can't orphan.
    #[cfg(windows)]
    job: Option<job::Job>,
}

impl Sidecar {
    pub fn new() -> Self {
        Sidecar {
            child: None,
            #[cfg(windows)]
            job: job::Job::new(),
        }
    }

    /// Spawn the sidecar unless one is already running (either ours, or an
    /// instance already listening on the port — reuse it rather than piling up
    /// duplicate writers on the same SQLite DB).
    pub fn ensure_spawned(&mut self) -> std::io::Result<()> {
        if self.child.is_some() || port_in_use() {
            return Ok(());
        }
        let dir = sidecar_dir();
        let python = dir.join(".venv").join("Scripts").join("python.exe");
        let child = Command::new(python)
            .current_dir(&dir)
            .args([
                "-m",
                "uvicorn",
                "app.main:app",
                "--port",
                PORT,
                "--log-level",
                "warning",
            ])
            .spawn()?;
        #[cfg(windows)]
        if let Some(job) = &self.job {
            job.assign(&child);
        }
        self.child = Some(child);
        Ok(())
    }

    pub fn shutdown(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for Sidecar {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Is something already listening on the sidecar port? A quick blocking connect
/// so `ensure_spawned` can reuse a running instance instead of duplicating it.
fn port_in_use() -> bool {
    use std::net::TcpStream;
    "127.0.0.1:8765"
        .parse()
        .ok()
        .and_then(|addr| TcpStream::connect_timeout(&addr, Duration::from_millis(300)).ok())
        .is_some()
}

#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;

    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// A Job Object configured to kill its assigned processes when the handle
    /// closes — which the OS does automatically when this process terminates.
    pub struct Job(HANDLE);

    // The handle is only ever touched from the single UI thread that owns the
    // Sidecar; wrapping it makes the containing App `Send` where iced needs it.
    unsafe impl Send for Job {}

    impl Job {
        pub fn new() -> Option<Job> {
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    return None;
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let ok = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const core::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                if ok == 0 {
                    CloseHandle(handle);
                    return None;
                }
                Some(Job(handle))
            }
        }

        pub fn assign(&self, child: &Child) {
            unsafe {
                AssignProcessToJobObject(self.0, child.as_raw_handle() as HANDLE);
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            // Closing the last handle triggers KILL_ON_JOB_CLOSE.
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

/// Where the vendored sidecar lives. Dev: `sidecar/` under the working dir;
/// B3 will resolve this next to the bundled executable.
fn sidecar_dir() -> PathBuf {
    std::env::current_dir().unwrap_or_default().join("sidecar")
}

// --- HTTP client ---

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

pub async fn health() -> bool {
    client()
        .get(format!("{BASE_URL}/health"))
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// Poll `/health` until it responds or the timeout elapses.
pub async fn wait_healthy(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        if health().await {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

#[derive(serde::Deserialize)]
struct ScopeOut {
    id: String,
}

#[derive(serde::Deserialize)]
struct ScopeByPathOut {
    scope_id: String,
}

async fn find_scope_by_path(path: &str) -> Result<Option<String>, String> {
    let resp = client()
        .get(format!("{BASE_URL}/admin/scope-by-path"))
        .header("X-Principal-External-Id", PRINCIPAL)
        .query(&[("path", path)])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("find scope failed: HTTP {}", resp.status()));
    }
    // Returns null if no scope found
    let scope: Option<ScopeByPathOut> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(scope.map(|s| s.scope_id))
}

async fn create_scope(name: &str) -> Result<String, String> {
    let resp = client()
        .post(format!("{BASE_URL}/scopes"))
        .header("X-Principal-External-Id", PRINCIPAL)
        .json(&serde_json::json!({ "name": name }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("create scope failed: HTTP {}", resp.status()));
    }
    let scope: ScopeOut = resp.json().await.map_err(|e| e.to_string())?;
    Ok(scope.id)
}

async fn create_source(scope_id: &str, path: &str) -> Result<(), String> {
    let resp = client()
        .post(format!("{BASE_URL}/scopes/{scope_id}/sources"))
        .header("X-Principal-External-Id", PRINCIPAL)
        .json(&serde_json::json!({ "path": path, "poll_interval_seconds": 5 }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("create source failed: HTTP {}", resp.status()));
    }
    Ok(())
}

/// Wait until the sidecar is healthy (used before opening an already-indexed
/// folder's chat UI).
pub async fn ensure_ready() -> bool {
    wait_healthy(Duration::from_secs(45)).await
}

#[derive(serde::Deserialize)]
struct DocOut {
    status: String,
}

/// Poll a scope's ingestion progress: returns (finished_docs, total_docs).
/// A doc is "finished" once it reaches a terminal status.
pub async fn document_progress(scope_id: String) -> Result<(usize, usize), String> {
    let resp = client()
        .get(format!("{BASE_URL}/scopes/{scope_id}/documents"))
        .header("X-Principal-External-Id", PRINCIPAL)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("progress: HTTP {}", resp.status()));
    }
    let docs: Vec<DocOut> = resp.json().await.map_err(|e| e.to_string())?;
    let total = docs.len();
    let done = docs
        .iter()
        .filter(|d| matches!(d.status.as_str(), "ready" | "failed" | "unsupported"))
        .count();
    Ok((done, total))
}

/// The web chat UI URL (served by the sidecar itself, same origin as the API).
/// When a scope id is given, the UI opens focused on just that workspace (the
/// folder the user opened) and hides the full workspace switcher.
pub fn web_url(scope_id: Option<&str>) -> String {
    match scope_id {
        Some(id) => format!("{BASE_URL}/?ws={id}"),
        None => format!("{BASE_URL}/"),
    }
}

/// Best-effort OS toast notification (Windows PowerShell toast; no-op on
/// failure — the in-app modal is the reliable channel).
pub fn os_notify(title: &str, body: &str) {
    let esc = |s: &str| s.replace('\'', "''");
    let script = format!(
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] > $null; \
         [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType=WindowsRuntime] > $null; \
         $t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
         $n = $t.GetElementsByTagName('text'); \
         $n.Item(0).AppendChild($t.CreateTextNode('{}')) > $null; \
         $n.Item(1).AppendChild($t.CreateTextNode('{}')) > $null; \
         $toast = [Windows.UI.Notifications.ToastNotification]::new($t); \
         [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Lattice').Show($toast);",
        esc(title),
        esc(body)
    );
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
        .spawn();
}

/// Open a URL in the default browser (no console flash on Windows).
pub fn open_browser(url: &str) {
    let _ = Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn();
}

/// High-level "Open with Index" flow: wait for the sidecar to be healthy, check
/// if the path is already indexed (reuse existing scope), otherwise create a new
/// scope and register it as a filesystem source. Returns the scope id.
pub async fn open_with_index(dir: PathBuf) -> Result<String, String> {
    if !wait_healthy(Duration::from_secs(45)).await {
        return Err("index sidecar didn't start in time".to_string());
    }
    let path_str = dir.to_string_lossy();

    // Check if this path is already indexed
    if let Some(scope_id) = find_scope_by_path(&path_str).await? {
        return Ok(scope_id);
    }

    // Not indexed yet - create a new scope
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| dir.display().to_string());
    let scope_id = create_scope(&name).await?;
    create_source(&scope_id, &path_str).await?;
    Ok(scope_id)
}
