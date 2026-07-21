use iced::widget::{button, column, container, row, text, Space};
use iced::{Alignment, Element, Length};

use super::style;
use crate::message::Message;

/// A centered Settings modal. Dismissed via the Close button or Esc.
pub fn view<'a>(dark_mode: bool) -> Element<'a, Message> {
    let header = row![
        text("Settings").size(16).width(Length::Fill),
        button(text("Close").size(13))
            .padding([4, 10])
            .style(style::tool_button)
            .on_press(Message::SettingsClose),
    ]
    .align_y(Alignment::Center);

    let dark_toggle = row![
        column![
            text("Dark mode").size(14),
            text("Use a dark color theme")
                .size(11)
                .style(style::dim_text),
        ]
        .spacing(1)
        .width(Length::Fill),
        button(text(if dark_mode { "On" } else { "Off" }).size(13))
            .padding([5, 14])
            .style(if dark_mode {
                style::primary_button
            } else {
                style::tool_button
            })
            .on_press(Message::ToggleDarkMode),
    ]
    .align_y(Alignment::Center);

    let card = container(
        column![
            header,
            container(iced::widget::rule::horizontal(1)).width(Length::Fill),
            dark_toggle,
            Space::new().height(Length::Fixed(4.0)),
        ]
        .spacing(14)
        .padding(18),
    )
    .width(Length::Fixed(440.0))
    .style(style::popup);

    container(card)
        .width(Length::Fill)
        .height(Length::Fill)
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .style(style::backdrop)
        .into()
}
