#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod format;
mod fs;
mod message;
mod navigation;
mod selection;
mod sort;
mod ui;

use app::App;

fn main() -> iced::Result {
    iced::application(App::new, App::update, App::view)
        .title(App::title)
        .theme(App::theme)
        .subscription(App::subscription)
        .window_size((1100.0, 720.0))
        .run()
}
