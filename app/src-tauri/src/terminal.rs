// Opt-in terminal drawer backend: a real PTY per session (ConPTY on Windows via
// portable-pty), streamed to the frontend xterm.js over Tauri events.
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, State};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
pub struct TerminalState {
    sessions: Mutex<HashMap<u32, Session>>,
    next_id: Mutex<u32>,
}

#[cfg(windows)]
fn default_shell() -> String {
    // ponytail: powershell.exe is guaranteed on Windows; a pwsh/custom-shell
    // picker is a later setting.
    "powershell.exe".to_string()
}
#[cfg(not(windows))]
fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
}

#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    state: State<TerminalState>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    if !cwd.is_empty() {
        cmd.cwd(cwd);
    }
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave); // close our slave handle so reads see EOF when the shell exits

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = {
        let mut n = state.next_id.lock().unwrap();
        *n += 1;
        *n
    };

    // Pump PTY output to the frontend until EOF, then signal exit.
    let app2 = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                // ponytail: from_utf8_lossy can mangle a multibyte char split across
                // a read boundary — fine for v1 shell output; upgrade to a
                // byte-accurate channel if CJK/emoji output shows artifacts.
                Ok(n) => {
                    let _ = app2.emit(
                        &format!("terminal:data:{id}"),
                        String::from_utf8_lossy(&buf[..n]).to_string(),
                    );
                }
            }
        }
        let _ = app2.emit(&format!("terminal:exit:{id}"), ());
    });

    state
        .sessions
        .lock()
        .unwrap()
        .insert(id, Session { master: pair.master, writer, child });
    Ok(id)
}

#[tauri::command]
pub fn terminal_write(state: State<TerminalState>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(s) = sessions.get_mut(&id) {
        s.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        s.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(state: State<TerminalState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(s) = state.sessions.lock().unwrap().get(&id) {
        s.master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_kill(state: State<TerminalState>, id: u32) -> Result<(), String> {
    if let Some(mut s) = state.sessions.lock().unwrap().remove(&id) {
        let _ = s.child.kill();
    }
    Ok(())
}
