use iced::widget::{button, container, row, text, Space};
use iced::{Alignment, Element, Length};

use super::style;
use crate::message::Message;

/// A slim command strip beneath the address bar: New folder, Cut/Copy/Paste,
/// Rename, Delete. Buttons disable when their action doesn't apply.
pub fn view<'a>(
    has_selection: bool,
    single_selection: bool,
    has_clipboard: bool,
) -> Element<'a, Message> {
    let bar = row![
        cmd("New folder", Some(Message::NewFolder)),
        gap(),
        cmd("Cut", has_selection.then_some(Message::Cut)),
        cmd("Copy", has_selection.then_some(Message::Copy)),
        cmd("Paste", has_clipboard.then_some(Message::Paste)),
        gap(),
        cmd("Rename", single_selection.then_some(Message::RenameSelected)),
        cmd("Delete", has_selection.then_some(Message::DeleteSelected)),
    ]
    .spacing(2)
    .align_y(Alignment::Center);

    container(bar)
        .padding([4, 8])
        .width(Length::Fill)
        .style(style::band)
        .into()
}

fn cmd<'a>(label: &'a str, msg: Option<Message>) -> Element<'a, Message> {
    button(text(label).size(13))
        .padding([4, 10])
        .style(style::tool_button)
        .on_press_maybe(msg)
        .into()
}

fn gap<'a>() -> Element<'a, Message> {
    Space::new().width(Length::Fixed(10.0)).into()
}
