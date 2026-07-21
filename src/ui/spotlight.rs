use iced::widget::{button, column, container, row, rule, text, text_input};
use iced::{Alignment, Element, Length};

use super::{search, style};
use crate::index::{SearchHit, SearchMode};
use crate::message::Message;

pub const SPOTLIGHT_ID: &str = "spotlight-input";

/// Base window height (just the input + mode row). The window grows to
/// `BASE_HEIGHT + RESULTS_HEIGHT` when there are results (which then scroll).
pub const BASE_HEIGHT: f32 = 92.0;
pub const RESULTS_HEIGHT: f32 = 380.0;
pub const WIDTH: f32 = 720.0;

/// The floating launcher: a big search field with a Name/Text/Semantic radio,
/// and (only when there are results) the shared results list below.
pub fn view<'a>(
    query: &'a str,
    mode: SearchMode,
    results: &'a [SearchHit],
    searching: bool,
) -> Element<'a, Message> {
    let field = text_input("Search\u{2026}", query)
        .id(SPOTLIGHT_ID)
        .on_input(Message::SearchInput)
        .on_submit(Message::SearchSubmit)
        .size(22)
        .padding([12, 16])
        .width(Length::Fill);

    let modes = row![
        mode_button("Name", SearchMode::Name, mode),
        mode_button("Text", SearchMode::Text, mode),
        mode_button("Semantic", SearchMode::Semantic, mode),
    ]
    .spacing(4)
    .align_y(Alignment::Center);

    let header = row![field, modes]
        .spacing(10)
        .align_y(Alignment::Center)
        .padding([8, 12]);

    let mut content = column![header];
    if !results.is_empty() || searching {
        content = content.push(rule::horizontal(1));
        content = content.push(search::results(results, query, searching));
    }

    container(content)
        .width(Length::Fill)
        .height(Length::Fill)
        .clip(true) // keep the rounded corners even when results fill it
        .style(style::spotlight)
        .into()
}

fn mode_button<'a>(label: &'a str, this: SearchMode, current: SearchMode) -> Element<'a, Message> {
    button(text(label).size(13))
        .padding([5, 10])
        .style(style::sidebar_button(this == current))
        .on_press(Message::SearchModeChanged(this))
        .into()
}
