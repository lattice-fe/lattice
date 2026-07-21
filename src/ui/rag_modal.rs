use iced::widget::{button, column, container, progress_bar, row, rule, text, Space};
use iced::{Alignment, Element, Length};

use super::style;
use crate::message::Message;

/// The "Open with Index" progress modal: shown for a first-time folder index so
/// the user sees file-by-file progress instead of an empty browser, and can send
/// it to the background. Flips to a "ready" state when ingestion completes.
pub fn view<'a>(
    name: &'a str,
    done: usize,
    total: usize,
    finished: bool,
    error: Option<&'a str>,
    spinner: &'a str,
) -> Element<'a, Message> {
    let title = text("Index").size(16).width(Length::Fill);

    let body: Element<'a, Message> = if let Some(err) = error {
        column![
            text(format!("Couldn't index {name}")).size(14),
            text(err).size(12).style(style::dim_text),
        ]
        .spacing(6)
        .into()
    } else if finished {
        column![
            text(format!("\u{2713} {name} is ready in Index")).size(15),
            text(format!("{total} files indexed. Ask questions about this folder\u{2019}s contents."))
                .size(12)
                .style(style::dim_text),
        ]
        .spacing(6)
        .into()
    } else if total == 0 {
        column![
            text(format!("{spinner}  Scanning {name}\u{2026}")).size(14),
            text("Discovering documents\u{2026}").size(12).style(style::dim_text),
        ]
        .spacing(6)
        .into()
    } else {
        column![
            text(format!("{spinner}  Indexing {name}\u{2026}")).size(14),
            text(format!("{done} of {total} files processed"))
                .size(13)
                .style(style::dim_text),
            progress_bar(0.0..=(total as f32), done as f32),
            text("You can keep working \u{2014} we\u{2019}ll notify you when it\u{2019}s ready.")
                .size(11)
                .style(style::dim_text),
        ]
        .spacing(8)
        .into()
    };

    let buttons: Element<'a, Message> = if finished {
        row![
            Space::new().width(Length::Fill),
            button(text("Close").size(13))
                .padding([7, 12])
                .style(style::tool_button)
                .on_press(Message::RagModalDismiss),
            button(text("Open in Index").size(13))
                .padding([7, 14])
                .style(style::primary_button)
                .on_press(Message::RagOpenBrowser),
        ]
        .spacing(8)
        .align_y(Alignment::Center)
        .into()
    } else if error.is_some() {
        row![
            Space::new().width(Length::Fill),
            button(text("Close").size(13))
                .padding([7, 12])
                .style(style::tool_button)
                .on_press(Message::RagModalDismiss),
        ]
        .into()
    } else {
        row![
            Space::new().width(Length::Fill),
            button(text("Run in background").size(13))
                .padding([7, 14])
                .style(style::tool_button)
                .on_press(Message::RagModalBackground),
        ]
        .into()
    };

    let card = container(
        column![
            title,
            container(rule::horizontal(1)).width(Length::Fill),
            body,
            Space::new().height(Length::Fixed(4.0)),
            buttons,
        ]
        .spacing(14)
        .padding(20),
    )
    .width(Length::Fixed(460.0))
    .style(style::popup);

    container(card)
        .width(Length::Fill)
        .height(Length::Fill)
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .style(style::backdrop)
        .into()
}
