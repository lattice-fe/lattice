use std::path::Path;

use iced::widget::{button, container, row, text, text_input, tooltip};
use iced::{Alignment, Element, Length};

use super::search::SEARCH_ID;
use super::{breadcrumb, style};
use crate::message::Message;

pub fn view<'a>(
    current: &Path,
    editing: Option<&'a str>,
    can_back: bool,
    can_forward: bool,
    can_up: bool,
    query: &'a str,
    searching: bool,
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

    // Compact search, pinned right — like the reference's "Search or jump to…".
    let field = text_input("Search\u{2026}", query)
        .id(SEARCH_ID)
        .on_input(Message::SearchInput)
        .on_submit(Message::SearchSubmit)
        .size(13)
        .padding(0)
        .width(Length::Fill);
    let mut search_inner = row![field].spacing(8).align_y(Alignment::Center);
    if searching {
        search_inner = search_inner.push(text("\u{2026}").size(13).style(style::dim_text));
    } else if !query.is_empty() {
        search_inner = search_inner.push(
            button(text("\u{00d7}").size(14).style(style::dim_text))
                .padding(0)
                .style(style::tool_button)
                .on_press(Message::SearchClear),
        );
    }
    let search = container(search_inner)
        .width(Length::Fixed(240.0))
        .padding([7, 12])
        .align_y(Alignment::Center)
        .style(style::search_pill);

    let settings = icon_button("\u{2699}", "Settings", Some(Message::SettingsOpen));

    let bar = row![
        nav,
        container(breadcrumb::view(current, editing)).width(Length::Fill),
        search,
        settings,
    ]
    .spacing(10)
    .align_y(Alignment::Center);

    container(bar)
        .padding([7, 12])
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
