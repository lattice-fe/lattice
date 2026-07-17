use iced::widget::{container, row, text, Space};
use iced::{Element, Length};

use super::style;
use crate::fs::Entry;
use crate::message::Message;
use crate::selection::Selection;

pub fn view<'a>(
    entries: &'a [Entry],
    selection: &'a Selection,
    notice: Option<&'a str>,
) -> Element<'a, Message> {
    let count = entries.len();
    let items = if count == 1 {
        "1 item".to_string()
    } else {
        format!("{count} items")
    };

    let selection_text = if selection.is_empty() {
        String::new()
    } else {
        let total: u64 = selection
            .indices()
            .filter_map(|i| entries.get(i))
            .filter(|e| !e.is_dir)
            .map(|e| e.size)
            .sum();
        if total > 0 {
            format!("{} selected  ({})", selection.len(), crate::format::size(total))
        } else {
            format!("{} selected", selection.len())
        }
    };

    let middle: Element<'a, Message> = match notice {
        Some(msg) => text(msg)
            .size(12)
            .color(iced::Color::from_rgb8(180, 60, 60))
            .into(),
        None => Space::new().width(Length::Fill).into(),
    };

    let bar = row![
        text(items).size(12),
        Space::new().width(Length::Fixed(16.0)),
        middle,
        Space::new().width(Length::Fill),
        text(selection_text).size(12),
    ]
    .spacing(8);

    container(bar)
        .padding([4, 10])
        .width(Length::Fill)
        .style(style::band)
        .into()
}
