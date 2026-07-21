use iced::alignment::Horizontal;
use iced::widget::{
    button, column, container, mouse_area, row, scrollable, svg, text, text_input, Column,
};
use iced::{Alignment, Element, Length};

use super::style;
use crate::fs::Entry;
use crate::message::Message;
use crate::selection::Selection;
use crate::sort::{Direction, SortColumn, SortState};
use crate::{format, ui::icons};

/// Widget id for the inline rename field, so we can focus it programmatically.
pub const RENAME_ID: &str = "rename-field";

pub fn view<'a>(
    entries: &'a [Entry],
    selection: &'a Selection,
    sort: SortState,
    loading: bool,
    error: Option<&'a str>,
    renaming: Option<(usize, &'a str)>,
) -> Element<'a, Message> {
    let header = row![
        header_cell("Name", SortColumn::Name, sort, Length::Fill, Horizontal::Left),
        header_cell(
            "Date modified",
            SortColumn::Modified,
            sort,
            Length::Fixed(style::COL_MODIFIED),
            Horizontal::Left
        ),
        header_cell(
            "Type",
            SortColumn::Type,
            sort,
            Length::Fixed(style::COL_TYPE),
            Horizontal::Left
        ),
        header_cell(
            "Size",
            SortColumn::Size,
            sort,
            Length::Fixed(style::COL_SIZE),
            Horizontal::Right
        ),
    ]
    .spacing(8)
    .padding(style::ROW_PADDING);

    let header = container(header)
        .width(Length::Fill)
        .padding([4, 0])
        .style(style::header);

    let body: Element<'a, Message> = if let Some(err) = error {
        centered(text(err).size(14).color(iced::Color::from_rgb8(180, 60, 60)))
    } else if loading {
        centered(text("Loading\u{2026}").size(14))
    } else if entries.is_empty() {
        centered(text("This folder is empty").size(14).style(style::dim_text))
    } else {
        let mut list: Column<'a, Message> = column![].spacing(1);
        for (i, entry) in entries.iter().enumerate() {
            let rename = match renaming {
                Some((ri, value)) if ri == i => Some(value),
                _ => None,
            };
            list = list.push(entry_row(i, entry, selection.contains(i), rename));
        }
        // Clickable filler so clicking below the entries clears the selection
        // (and offers the background context menu on right-click).
        let filler = mouse_area(container(text("")).width(Length::Fill).height(Length::Fixed(600.0)))
            .on_press(Message::BackgroundPressed)
            .on_right_press(Message::BackgroundRightPressed);
        list = list.push(filler);

        scrollable(list).height(Length::Fill).into()
    };

    column![header, body]
        .spacing(0)
        .width(Length::Fill)
        .height(Length::Fill)
        .into()
}

fn header_cell<'a>(
    label: &'a str,
    col: SortColumn,
    sort: SortState,
    width: Length,
    align: Horizontal,
) -> Element<'a, Message> {
    let indicator = if sort.column == col {
        match sort.direction {
            Direction::Ascending => "  \u{25B4}",
            Direction::Descending => "  \u{25BE}",
        }
    } else {
        ""
    };

    let content = container(text(format!("{label}{indicator}")).size(13))
        .width(Length::Fill)
        .align_x(align);

    button(content)
        .width(width)
        .padding([2, 4])
        .style(style::tool_button)
        .on_press(Message::SortBy(col))
        .into()
}

fn entry_row<'a>(
    index: usize,
    entry: &'a Entry,
    selected: bool,
    renaming: Option<&'a str>,
) -> Element<'a, Message> {
    let icon = svg(icons::for_kind(entry.kind))
        .width(Length::Fixed(style::ICON_SIZE))
        .height(Length::Fixed(style::ICON_SIZE));

    let name: Element<'a, Message> = match renaming {
        Some(value) => row![
            icon,
            text_input("", value)
                .id(RENAME_ID)
                .on_input(Message::RenameChanged)
                .on_submit(Message::RenameSubmit)
                .size(13)
                .padding([1, 4])
                .width(Length::Fill),
        ]
        .spacing(8)
        .align_y(Alignment::Center)
        .width(Length::Fill)
        .into(),
        None => row![icon, text(&entry.name).size(13)]
            .spacing(8)
            .align_y(Alignment::Center)
            .width(Length::Fill)
            .into(),
    };

    let modified = cell(format::datetime(entry.modified), style::COL_MODIFIED, Horizontal::Left);
    let type_col = cell(entry.type_label(), style::COL_TYPE, Horizontal::Left);
    let size = if entry.is_dir {
        cell(String::new(), style::COL_SIZE, Horizontal::Right)
    } else {
        cell(format::size(entry.size), style::COL_SIZE, Horizontal::Right)
    };

    let line = row![name, modified, type_col, size]
        .spacing(8)
        .padding(style::ROW_PADDING)
        .align_y(Alignment::Center);

    let styled = container(line)
        .width(Length::Fill)
        .height(Length::Fixed(style::ROW_HEIGHT))
        .align_y(Alignment::Center)
        .style(style::row(selected));

    // While renaming, hand all interaction to the text field.
    if renaming.is_some() {
        return styled.into();
    }

    mouse_area(styled)
        .on_press(Message::EntryPressed(index))
        .on_right_press(Message::EntryRightPressed(index))
        .into()
}

fn cell<'a>(value: String, width: f32, align: Horizontal) -> Element<'a, Message> {
    container(text(value).size(13).style(style::dim_text))
        .width(Length::Fixed(width))
        .align_x(align)
        .into()
}

fn centered<'a>(content: impl Into<Element<'a, Message>>) -> Element<'a, Message> {
    container(content)
        .width(Length::Fill)
        .height(Length::Fill)
        .center_x(Length::Fill)
        .center_y(Length::Fill)
        .into()
}
