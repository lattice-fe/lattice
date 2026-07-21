use std::path::Path;

use iced::widget::{button, mouse_area, row, text, text_input, Row};
use iced::{Element, Length};

use super::style;
use crate::message::Message;

/// Widget id for the address text field, so we can focus it programmatically.
pub const ADDRESS_ID: &str = "address-bar";

/// The address bar. In normal mode it's a clickable breadcrumb of the current
/// path; clicking empty space switches to an editable text field.
pub fn view<'a>(current: &Path, editing: Option<&'a str>) -> Element<'a, Message> {
    match editing {
        Some(value) => text_input("Enter a path", value)
            .id(ADDRESS_ID)
            .on_input(Message::AddressChanged)
            .on_submit(Message::AddressSubmit)
            .padding([4, 8])
            .width(Length::Fill)
            .into(),
        None => breadcrumb(current),
    }
}

fn breadcrumb<'a>(current: &Path) -> Element<'a, Message> {
    let mut chain: Vec<&Path> = current.ancestors().collect();
    chain.reverse();

    let mut segments: Row<'a, Message> = row![].spacing(2).align_y(iced::Alignment::Center);
    for (i, anc) in chain.iter().enumerate() {
        if i > 0 {
            segments = segments.push(text("›").size(14).style(style::dim_text));
        }
        let label = match anc.file_name() {
            Some(name) => name.to_string_lossy().into_owned(),
            None => anc.display().to_string(), // root, e.g. "C:\"
        };
        let target = anc.to_path_buf();
        segments = segments.push(
            button(text(label).size(14))
                .padding([2, 6])
                .style(style::tool_button)
                .on_press(Message::Navigate(target)),
        );
    }

    // Clicking empty space in the bar switches to edit mode.
    mouse_area(
        iced::widget::container(segments)
            .width(Length::Fill)
            .padding([2, 4]),
    )
    .on_press(Message::AddressEditStart)
    .into()
}
