//! The right-hand inspector: a live preview and details for the selected entry.

use iced::widget::{button, column, container, row, rule, svg, text, Space};
use iced::{Alignment, Element, Length};

use super::{icons, style};
use crate::fs::Entry;
use crate::format;
use crate::message::Message;

pub const WIDTH: f32 = 300.0;

pub fn view(entry: Option<&Entry>) -> Element<'_, Message> {
    let inner: Element<'_, Message> = match entry {
        Some(e) => details(e),
        None => container(
            text("Select an item to see details")
                .size(13)
                .font(style::BODY)
                .style(style::dim_text),
        )
        .width(Length::Fill)
        .height(Length::Fill)
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .into(),
    };

    container(inner)
        .width(Length::Fixed(WIDTH))
        .height(Length::Fill)
        .padding(20)
        .style(style::sidebar)
        .into()
}

fn details(e: &Entry) -> Element<'_, Message> {
    let kind = e.kind;

    // Big preview tile.
    let glyph = svg(icons::for_kind_mono(kind))
        .width(Length::Fixed(46.0))
        .height(Length::Fixed(46.0))
        .style(move |theme, _| iced::widget::svg::Style { color: Some(style::tone(kind, theme).1) });
    let preview = container(glyph)
        .width(Length::Fill)
        .height(Length::Fixed(150.0))
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .style(style::tile(kind, 14.0));

    let size_str = if e.is_dir { "\u{2014}".to_string() } else { format::size(e.size) };

    let name = text(&e.name).size(19); // serif (default)
    let sub = text(format!("{} \u{00b7} {}", e.type_label(), size_str))
        .size(12.5)
        .font(style::BODY)
        .style(style::dim_text);

    let open = button(
        container(text("Open").size(13).font(style::BODY))
            .width(Length::Fill)
            .center_x(Length::Fill),
    )
    .width(Length::Fill)
    .padding([9, 12])
    .style(style::success_button)
    .on_press(Message::KeyActivate);

    let where_str = e
        .path
        .parent()
        .map(|p| p.display().to_string())
        .unwrap_or_default();

    let info = column![
        info_label("Information"),
        info_row("Kind", e.type_label()),
        info_row("Size", size_str),
        info_row("Where", where_str),
        info_row("Modified", format::datetime(e.modified)),
    ]
    .spacing(11);

    column![
        preview,
        column![name, sub].spacing(3),
        open,
        rule::horizontal(1),
        info,
    ]
    .spacing(18)
    .into()
}

fn info_label(s: &str) -> Element<'_, Message> {
    text(s)
        .size(11)
        .font(style::BODY)
        .style(style::dim_text)
        .into()
}

fn info_row<'a>(key: &'a str, value: String) -> Element<'a, Message> {
    row![
        text(key).size(12.5).font(style::BODY).style(style::dim_text),
        Space::new().width(Length::Fill),
        text(value).size(12.5).font(style::BODY),
    ]
    .align_y(Alignment::Center)
    .spacing(12)
    .into()
}
