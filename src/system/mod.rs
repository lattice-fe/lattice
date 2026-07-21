//! System integration: the global Alt+Space hotkey and the tray icon. Both run
//! on a dedicated thread that pumps the Win32 message loop (required by
//! tray-icon), forwarding events to the app through an iced subscription.
#![cfg(windows)]

use iced::futures::channel::mpsc::Sender as OutSender;
use iced::futures::{SinkExt, Stream};
use tokio::sync::mpsc::Sender;

use global_hotkey::hotkey::{Code, HotKey, Modifiers};
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use tray_icon::menu::{Menu, MenuEvent, MenuItem};
use tray_icon::{Icon, TrayIconBuilder};

use crate::message::Message;

#[derive(Debug, Clone, Copy)]
enum SysEvent {
    Hotkey,
    TrayOpen,
    TrayQuit,
}

/// iced subscription: spawns the hotkey/tray thread and streams its events.
pub fn connect() -> impl Stream<Item = Message> {
    iced::stream::channel(32, |mut output: OutSender<Message>| async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<SysEvent>(32);
        std::thread::spawn(move || run_system_thread(tx));

        while let Some(event) = rx.recv().await {
            let msg = match event {
                SysEvent::Hotkey => Message::ToggleSpotlight,
                SysEvent::TrayOpen => Message::ShowMainWindow,
                SysEvent::TrayQuit => Message::QuitApp,
            };
            if output.send(msg).await.is_err() {
                break;
            }
        }
    })
}

fn run_system_thread(tx: Sender<SysEvent>) {
    // --- global hotkey (global-hotkey runs its own message thread) ---
    let tx_hotkey = tx.clone();
    GlobalHotKeyEvent::set_event_handler(Some(move |event: GlobalHotKeyEvent| {
        // The event fires on both press and release; act on press only.
        if event.state == HotKeyState::Pressed {
            let _ = tx_hotkey.blocking_send(SysEvent::Hotkey);
        }
    }));

    let manager = match GlobalHotKeyManager::new() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("[sys] hotkey manager failed: {e}");
            return;
        }
    };
    let hotkey = HotKey::new(Some(Modifiers::ALT), Code::Space);
    if let Err(e) = manager.register(hotkey) {
        eprintln!("[sys] register Alt+Space failed: {e}");
    }

    // --- tray icon + menu ---
    let menu = Menu::new();
    let open_item = MenuItem::new("Open Lattice", true, None);
    let quit_item = MenuItem::new("Quit", true, None);
    let _ = menu.append(&open_item);
    let _ = menu.append(&quit_item);
    let open_id = open_item.id().clone();
    let quit_id = quit_item.id().clone();

    let tx_menu = tx.clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        let sys = if event.id == open_id {
            SysEvent::TrayOpen
        } else if event.id == quit_id {
            SysEvent::TrayQuit
        } else {
            return;
        };
        let _ = tx_menu.blocking_send(sys);
    }));

    let tray = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_tooltip("Lattice")
        .with_icon(app_icon())
        .build();
    let _tray = match tray {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[sys] tray build failed: {e}");
            return;
        }
    };

    // Keep the manager and tray alive for the life of the message loop.
    let _manager = manager;
    run_message_loop();
}

/// The tray icon — the Lattice brand mark, decoded from the bundled PNG (baked
/// into the binary, so there's no runtime file dependency).
fn app_icon() -> Icon {
    let png = include_bytes!("../../branding/tray-32.png");
    let img = image::load_from_memory(png)
        .expect("valid tray icon png")
        .to_rgba8();
    let (w, h) = img.dimensions();
    Icon::from_rgba(img.into_raw(), w, h).expect("valid tray icon")
}

fn run_message_loop() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, GetMessageW, TranslateMessage, MSG,
    };
    unsafe {
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}
