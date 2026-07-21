#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod format;
mod fs;
mod index;
mod message;
mod navigation;
mod rag;
mod selection;
mod sort;
#[cfg(windows)]
mod system;
mod ui;

use app::App;

fn main() -> iced::Result {
    iced::daemon(App::new, App::update, App::view)
        .title(App::title)
        .theme(App::theme)
        .subscription(App::subscription)
        .run()
}
