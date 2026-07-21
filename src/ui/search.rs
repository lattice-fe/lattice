use iced::widget::{button, column, container, mouse_area, row, scrollable, svg, text, text_input, Column};
use iced::{Alignment, Element, Length};

use super::{icons, style};
use crate::fs::entry::classify;
use crate::index::{SearchHit, SearchMode};
use crate::message::Message;

pub const SEARCH_ID: &str = "search-input";

/// The search bar row: query field, Text/Semantic toggle, and (for now) an
/// "Index this folder" action for testing until the collections UI lands.
pub fn bar<'a>(
    query: &'a str,
    mode: SearchMode,
    active: bool,
    searching: bool,
) -> Element<'a, Message> {
    let field = text_input("Search indexed files\u{2026}", query)
        .id(SEARCH_ID)
        .on_input(Message::SearchInput)
        .on_submit(Message::SearchSubmit)
        .padding([4, 8])
        .width(Length::Fill);

    let mut bar = row![
        field,
        mode_button("Name", SearchMode::Name, mode),
        mode_button("Text", SearchMode::Text, mode),
        mode_button("Semantic", SearchMode::Semantic, mode),
    ]
    .spacing(6)
    .align_y(Alignment::Center);

    if searching {
        bar = bar.push(text("\u{2026}").size(13));
    }
    if active || !query.is_empty() {
        bar = bar.push(
            button(text("Clear").size(13))
                .padding([4, 8])
                .style(style::tool_button)
                .on_press(Message::SearchClear),
        );
    }
    bar = bar.push(
        button(text("\u{1F4C1} Folders").size(13))
            .padding([4, 8])
            .style(style::tool_button)
            .on_press(Message::CollectionsOpen),
    );
    bar = bar.push(
        button(text("\u{2699}").size(15))
            .padding([4, 9])
            .style(style::tool_button)
            .on_press(Message::SettingsOpen),
    );

    container(bar)
        .padding([4, 8])
        .width(Length::Fill)
        .style(style::band)
        .into()
}

fn mode_button<'a>(label: &'a str, this: SearchMode, current: SearchMode) -> Element<'a, Message> {
    button(text(label).size(13))
        .padding([4, 10])
        .style(style::sidebar_button(this == current))
        .on_press(Message::SearchModeChanged(this))
        .into()
}

/// The results panel that replaces the file list while a search is active.
pub fn results<'a>(hits: &'a [SearchHit], query: &'a str, searching: bool) -> Element<'a, Message> {
    if hits.is_empty() {
        let msg = if searching {
            "Searching\u{2026}".to_string()
        } else if query.is_empty() {
            "Type a query and press Enter".to_string()
        } else {
            format!("No matches for \u{201c}{query}\u{201d}")
        };
        return container(text(msg).size(14).style(style::dim_text))
            .width(Length::Fill)
            .height(Length::Fill)
            .center_x(Length::Fill)
            .center_y(Length::Fill)
            .into();
    }

    let mut list: Column<'a, Message> = column![].spacing(2).padding([6, 8]);
    for hit in hits {
        list = list.push(result_row(hit));
    }
    scrollable(list).height(Length::Fill).into()
}

fn result_row<'a>(hit: &'a SearchHit) -> Element<'a, Message> {
    let kind = classify(&hit.file_path, false);
    let icon = svg(icons::for_kind(kind))
        .width(Length::Fixed(20.0))
        .height(Length::Fixed(20.0));

    let name = hit
        .file_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| hit.file_path.display().to_string());
    let dir = hit
        .file_path
        .parent()
        .map(|p| p.display().to_string())
        .unwrap_or_default();

    let mut body = column![text(name).size(14), text(dir).size(11).style(style::dim_text)].spacing(1);
    let snippet = clean_snippet(&hit.snippet);
    if !snippet.is_empty() {
        body = body.push(text(snippet).size(12).style(style::dim_text));
    }
    let body = body.width(Length::Fill);

    let line = row![icon, body]
        .spacing(10)
        .padding([4, 6])
        .align_y(Alignment::Start);

    mouse_area(
        container(line)
            .width(Length::Fill)
            .style(style::row(false)),
    )
    .on_press(Message::OpenResult(hit.file_path.clone()))
    .into()
}

/// Collapse whitespace/newlines in an FTS snippet so it reads as one line.
/// (Match markers `[` `]` from `snippet()` are left in as lightweight emphasis.)
fn clean_snippet(s: &str) -> String {
    let collapsed: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() > 200 {
        collapsed.chars().take(200).collect::<String>() + "\u{2026}"
    } else {
        collapsed
    }
}
