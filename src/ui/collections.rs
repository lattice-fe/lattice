use std::collections::HashMap;
use std::path::Path;

use iced::widget::{button, column, container, row, scrollable, text, Column};
use iced::{Alignment, Element, Length};

use super::style;
use crate::index::CollectionInfo;
use crate::message::Message;

/// Which long-running operation a collection is currently busy with, so the
/// matching button can be swapped for a spinner.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BusyKind {
    Removing,
    Embedding,
    Reindexing,
}

/// Braille spinner frames.
pub const SPINNER: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/// A centered modal listing indexed collections, with add/remove/reindex and a
/// per-collection semantic toggle. Dismissed via the Close button or Esc.
pub fn view<'a>(
    collections: &'a [CollectionInfo],
    current: &Path,
    busy: &'a HashMap<i64, BusyKind>,
    progress: &'a HashMap<i64, (usize, usize)>,
    spinner: &'a str,
) -> Element<'a, Message> {
    let header = row![
        text("Indexed folders").size(16).width(Length::Fill),
        button(text("Close").size(13))
            .padding([4, 10])
            .style(style::tool_button)
            .on_press(Message::CollectionsClose),
    ]
    .align_y(Alignment::Center);

    let mut list: Column<'a, Message> = column![].spacing(8);
    if collections.is_empty() {
        list = list.push(
            text("No folders indexed yet. Add one below.")
                .size(13)
                .style(style::dim_text),
        );
    }
    for c in collections {
        list = list.push(collection_row(c, busy.get(&c.id).copied(), progress.get(&c.id), spinner));
    }

    let current_label = current
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| current.display().to_string());
    let add = button(
        text(format!("+  Add current folder  ({current_label})")).size(13),
    )
    .padding([7, 14])
    .style(style::primary_button)
    .on_press(Message::IndexCurrentFolder);

    let card = container(
        column![
            header,
            rule(),
            scrollable(list).height(Length::Fixed(320.0)),
            rule(),
            row![add].align_y(Alignment::Center),
        ]
        .spacing(12)
        .padding(18),
    )
    .width(Length::Fixed(640.0))
    .style(style::popup);

    // Dim backdrop is inert (non-interactive) so it can't swallow the card's
    // button clicks. Dismiss via the Close button or Esc.
    container(card)
        .width(Length::Fill)
        .height(Length::Fill)
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .style(style::backdrop)
        .into()
}

fn collection_row<'a>(
    c: &'a CollectionInfo,
    busy: Option<BusyKind>,
    progress: Option<&(usize, usize)>,
    spinner: &'a str,
) -> Element<'a, Message> {
    let name = c
        .root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| c.root.display().to_string());

    // Status line: either progress (with bar) or static status
    let status_line: Element<'a, Message> = if let Some((done, total)) = progress {
        let pct = if *total > 0 { (*done as f32 / *total as f32).min(1.0) } else { 0.0 };
        let bar_width = 120.0;
        let filled = (bar_width * pct) as u16;
        container(
            row![
                container(
                    row![
                        container(text("").width(Length::Fixed(filled as f32)))
                            .height(Length::Fixed(4.0))
                            .style(style::progress_bar),
                        text("").width(Length::Fill),
                    ]
                )
                .width(Length::Fixed(bar_width))
                .height(Length::Fixed(4.0))
                .style(style::progress_track),
                text(format!("  {}/{}", done, total)).size(11).style(style::dim_text),
            ]
            .spacing(0)
            .align_y(Alignment::Center),
        )
        .into()
    } else {
        text(format!("{} files · {}", c.file_count, c.status))
            .size(11)
            .style(style::dim_text)
            .into()
    };

    let info = column![
        text(name).size(14),
        text(c.root.display().to_string())
            .size(11)
            .style(style::dim_text),
        status_line,
    ]
    .spacing(1)
    .width(Length::Fill);

    let semantic_label = if c.semantic {
        "Semantic: On"
    } else {
        "Semantic: Off"
    };

    // Each action button becomes a spinner while its operation is running.
    let semantic_btn: Element<'a, Message> = if busy == Some(BusyKind::Embedding) {
        spinner_button(spinner)
    } else {
        button(text(semantic_label).size(12))
            .padding([4, 8])
            .style(style::sidebar_button(c.semantic))
            .on_press(Message::CollectionSemantic(c.id, !c.semantic))
            .into()
    };
    let reindex_btn: Element<'a, Message> = if busy == Some(BusyKind::Reindexing) {
        spinner_button(spinner)
    } else {
        button(text("Reindex").size(12))
            .padding([4, 8])
            .style(style::tool_button)
            .on_press(Message::CollectionReindex(c.id))
            .into()
    };
    let remove_btn: Element<'a, Message> = if busy == Some(BusyKind::Removing) {
        spinner_button(spinner)
    } else {
        button(text("Remove").size(12))
            .padding([4, 8])
            .style(style::tool_button)
            .on_press(Message::CollectionRemove(c.id))
            .into()
    };

    let actions = row![semantic_btn, reindex_btn, remove_btn]
        .spacing(6)
        .align_y(Alignment::Center);

    container(
        row![info, actions]
            .spacing(12)
            .align_y(Alignment::Center),
    )
    .padding(8)
    .style(style::row(false))
    .into()
}

/// A disabled button-sized cell showing the spinner glyph.
fn spinner_button<'a>(spinner: &'a str) -> Element<'a, Message> {
    container(text(spinner).size(13))
        .padding([4, 10])
        .center_x(Length::Shrink)
        .into()
}

fn rule<'a>() -> Element<'a, Message> {
    container(iced::widget::rule::horizontal(1))
        .width(Length::Fill)
        .into()
}
