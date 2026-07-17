use iced::widget::{button, column, container, mouse_area, row, text, Space};
use iced::{Element, Length, Point};

use super::style;
use crate::message::Message;

/// State for an open right-click context menu.
pub struct Menu {
    /// Window-relative position where the menu's top-left should sit.
    pub position: Point,
    /// The entry index that was right-clicked, or `None` for the background.
    pub target: Option<usize>,
}

const MENU_WIDTH: f32 = 210.0;

/// Render the context menu as a full-window overlay: a transparent backdrop
/// (click to dismiss) with the menu box positioned at the cursor.
pub fn view<'a>(menu: &Menu, has_clipboard: bool, target_is_dir: bool) -> Element<'a, Message> {
    let mut items: Vec<Element<'a, Message>> = Vec::new();

    match menu.target {
        Some(index) => {
            if target_is_dir {
                items.push(item("Open", Some(Message::ActivateEntry(index))));
                items.push(separator());
            }
            items.push(item("Cut", Some(Message::Cut)));
            items.push(item("Copy", Some(Message::Copy)));
            items.push(item("Rename", Some(Message::RenameStart(index))));
            items.push(separator());
            items.push(item("Delete", Some(Message::DeleteSelected)));
        }
        None => {
            items.push(item("New folder", Some(Message::NewFolder)));
            items.push(item(
                "Paste",
                has_clipboard.then_some(Message::Paste),
            ));
            items.push(separator());
            items.push(item("Refresh", Some(Message::Refresh)));
        }
    }

    let menu_box = container(column(items).spacing(1))
        .padding(4)
        .width(Length::Fixed(MENU_WIDTH))
        .style(style::popup);

    // Position with spacers so the menu's top-left lands at the cursor.
    let positioned = column![
        Space::new().height(Length::Fixed(menu.position.y.max(0.0))),
        row![
            Space::new().width(Length::Fixed(menu.position.x.max(0.0))),
            menu_box,
        ],
    ];

    mouse_area(
        container(positioned)
            .width(Length::Fill)
            .height(Length::Fill),
    )
    .on_press(Message::ContextClose)
    .on_right_press(Message::ContextClose)
    .into()
}

fn item<'a>(label: &'a str, msg: Option<Message>) -> Element<'a, Message> {
    button(
        container(text(label).size(13))
            .width(Length::Fill)
            .padding([2, 8]),
    )
    .width(Length::Fill)
    .padding(0)
    .style(style::menu_item)
    .on_press_maybe(msg)
    .into()
}

fn separator<'a>() -> Element<'a, Message> {
    container(iced::widget::rule::horizontal(1))
        .padding([2, 4])
        .into()
}
