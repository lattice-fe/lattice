use std::path::Path;

use iced::widget::{button, container, row, text, tooltip};
use iced::{Alignment, Element, Length};

use super::{breadcrumb, style};
use crate::message::Message;

#[allow(clippy::too_many_arguments)]
pub fn view<'a>(
    current: &Path,
    editing: Option<&'a str>,
    can_back: bool,
    can_forward: bool,
    can_up: bool,
    show_hidden: bool,
) -> Element<'a, Message> {
    let nav = row![
        icon_button("\u{2190}", "Back  (Alt+Left)", can_back.then_some(Message::GoBack)),
        icon_button(
            "\u{2192}",
            "Forward  (Alt+Right)",
            can_forward.then_some(Message::GoForward)
        ),
        icon_button("\u{2191}", "Up  (Backspace)", can_up.then_some(Message::GoUp)),
        icon_button("\u{27F3}", "Refresh  (F5)", Some(Message::Refresh)),
    ]
    .spacing(2)
    .align_y(Alignment::Center);

    let hidden_label = if show_hidden {
        "\u{1F441} Hidden"
    } else {
        "Hidden"
    };
    let hidden_toggle = button(text(hidden_label).size(13))
        .padding([4, 8])
        .style(style::tool_button)
        .on_press(Message::ToggleHidden);

    let bar = row![
        nav,
        container(breadcrumb::view(current, editing)).width(Length::Fill),
        hidden_toggle,
    ]
    .spacing(8)
    .align_y(Alignment::Center);

    container(bar)
        .padding([6, 8])
        .width(Length::Fill)
        .style(style::band)
        .into()
}

fn icon_button<'a>(glyph: &'a str, hint: &'a str, msg: Option<Message>) -> Element<'a, Message> {
    let btn = button(text(glyph).size(16))
        .padding([2, 8])
        .style(style::tool_button)
        .on_press_maybe(msg);

    tooltip(btn, text(hint).size(12), tooltip::Position::Bottom)
        .gap(4)
        .into()
}
