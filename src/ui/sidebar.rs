use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use iced::widget::{button, column, container, row, scrollable, svg, text, Column, Space};
use iced::{Alignment, Element, Length};

use super::{icons, style};
use crate::fs::{Drive, Entry, EntryKind, Shortcut};
use crate::message::Message;

pub fn view<'a>(
    quick: &'a [Shortcut],
    drives: &'a [Drive],
    expanded: &'a BTreeMap<PathBuf, Vec<Entry>>,
    current: &'a Path,
) -> Element<'a, Message> {
    let mut content: Column<'a, Message> = column![].spacing(2).padding([8, 6]);

    content = content.push(brand());
    content = content.push(Space::new().height(Length::Fixed(14.0)));
    content = content.push(section_label("Quick access"));
    for s in quick {
        content = content.push(leaf(&s.path, &s.label, EntryKind::Folder, 0, current));
    }

    content = content.push(Space::new().height(Length::Fixed(10.0)));
    content = content.push(section_label("This PC"));
    for d in drives {
        content = content.push(node(
            &d.path,
            d.display(),
            EntryKind::Drive,
            0,
            expanded,
            current,
        ));
    }

    container(scrollable(content).height(Length::Fill).style(style::scrollbar))
        .width(Length::Fixed(style::SIDEBAR_WIDTH))
        .height(Length::Fill)
        .style(style::sidebar)
        .into()
}

fn brand<'a>() -> Element<'a, Message> {
    let mark = svg(svg::Handle::from_memory(
        include_bytes!("../../branding/lattice-mark.svg").as_slice(),
    ))
    .width(Length::Fixed(22.0))
    .height(Length::Fixed(22.0));
    container(
        row![mark, text("lattice").size(18)]
            .spacing(9)
            .align_y(Alignment::Center),
    )
    .padding([4, 6])
    .into()
}

fn section_label<'a>(label: &'a str) -> Element<'a, Message> {
    container(text(label).size(12).font(style::BODY).style(style::dim_text))
        .padding([4, 6])
        .into()
}

/// A non-expandable entry (Quick Access shortcut).
fn leaf<'a>(
    path: &Path,
    label: &'a str,
    kind: EntryKind,
    depth: u16,
    current: &Path,
) -> Element<'a, Message> {
    let is_current = path == current;
    let btn = button(
        row![
            small_icon(kind),
            text(label).size(13).width(Length::Fill),
        ]
        .spacing(6)
        .align_y(Alignment::Center),
    )
    .padding([3, 6])
    .width(Length::Fill)
    .style(style::sidebar_button(is_current))
    .on_press(Message::Navigate(path.to_path_buf()));

    row![Space::new().width(Length::Fixed(indent(depth) + 16.0)), btn].into()
}

/// An expandable tree node (drive or folder). Children are only present when
/// this path is in `expanded`.
fn node<'a>(
    path: &Path,
    label: String,
    kind: EntryKind,
    depth: u16,
    expanded: &'a BTreeMap<PathBuf, Vec<Entry>>,
    current: &Path,
) -> Element<'a, Message> {
    let is_expanded = expanded.contains_key(path);
    let is_current = path == current;

    let arrow = if is_expanded { "\u{25BE}" } else { "\u{25B8}" };
    let arrow_btn = button(text(arrow).size(11))
        .padding([2, 3])
        .style(style::tool_button)
        .on_press(Message::SidebarToggleExpand(path.to_path_buf()));

    let label_btn = button(
        row![
            small_icon(kind),
            text(label).size(13).width(Length::Fill),
        ]
        .spacing(6)
        .align_y(Alignment::Center),
    )
    .padding([3, 6])
    .width(Length::Fill)
    .style(style::sidebar_button(is_current))
    .on_press(Message::Navigate(path.to_path_buf()));

    let header = row![Space::new().width(Length::Fixed(indent(depth))), arrow_btn, label_btn]
        .spacing(2)
        .align_y(Alignment::Center);

    let mut col = column![header].spacing(2);

    if is_expanded {
        if let Some(children) = expanded.get(path) {
            if children.is_empty() {
                col = col.push(
                    row![
                        Space::new().width(Length::Fixed(indent(depth + 1) + 16.0)),
                        text("(empty)").size(12).style(style::dim_text),
                    ]
                );
            }
            for child in children {
                col = col.push(node(
                    &child.path,
                    child.name.clone(),
                    EntryKind::Folder,
                    depth + 1,
                    expanded,
                    current,
                ));
            }
        }
    }

    col.into()
}

fn small_icon<'a>(kind: EntryKind) -> Element<'a, Message> {
    svg(icons::for_kind(kind))
        .width(Length::Fixed(16.0))
        .height(Length::Fixed(16.0))
        .into()
}

fn indent(depth: u16) -> f32 {
    depth as f32 * 14.0
}
