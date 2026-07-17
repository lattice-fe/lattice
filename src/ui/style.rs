use iced::widget::{button, container};
use iced::{Background, Border, Color, Padding, Theme};

pub const SIDEBAR_WIDTH: f32 = 220.0;
pub const ROW_HEIGHT: f32 = 26.0;
pub const ICON_SIZE: f32 = 18.0;

/// Horizontal padding for both the header and the entry rows. The right side is
/// wider than the left to leave a gutter for the overlaid scrollbar, so the
/// right-aligned Size column never sits underneath it. Kept identical on the
/// header (outside the scrollable) and the rows (inside it) so columns align.
pub const ROW_PADDING: Padding = Padding {
    top: 0.0,
    right: 18.0,
    bottom: 0.0,
    left: 10.0,
};

// Details-view column widths (Name takes the remaining space).
pub const COL_MODIFIED: f32 = 150.0;
pub const COL_TYPE: f32 = 130.0;
pub const COL_SIZE: f32 = 90.0;

fn rgb(r: u8, g: u8, b: u8) -> Color {
    Color::from_rgb8(r, g, b)
}

const SELECT_BG: Color = Color {
    r: 0.792,
    g: 0.878,
    b: 0.996,
    a: 1.0,
};
const HOVER_BG: Color = Color {
    r: 0.918,
    g: 0.945,
    b: 0.996,
    a: 1.0,
};

/// Style for a file-list row given its selection state.
pub fn row(selected: bool) -> impl Fn(&Theme) -> container::Style {
    move |_theme| {
        if selected {
            container::Style {
                background: Some(Background::Color(SELECT_BG)),
                border: Border {
                    radius: 3.0.into(),
                    ..Border::default()
                },
                ..container::Style::default()
            }
        } else {
            container::Style::default()
        }
    }
}

/// Header band above the file list.
pub fn header(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(rgb(245, 246, 248))),
        border: Border {
            color: rgb(220, 223, 228),
            width: 1.0,
            radius: 0.0.into(),
        },
        ..container::Style::default()
    }
}

/// The left navigation panel background.
pub fn sidebar(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(rgb(247, 248, 250))),
        ..container::Style::default()
    }
}

/// Toolbar / status bar band.
pub fn band(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(rgb(250, 250, 251))),
        ..container::Style::default()
    }
}

/// A subtle, borderless toolbar button (back/forward/up, sidebar entries).
pub fn tool_button(theme: &Theme, status: button::Status) -> button::Style {
    let base = button::Style {
        background: None,
        text_color: theme.palette().text,
        border: Border {
            radius: 4.0.into(),
            ..Border::default()
        },
        ..button::Style::default()
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(HOVER_BG)),
            ..base
        },
        button::Status::Pressed => button::Style {
            background: Some(Background::Color(SELECT_BG)),
            ..base
        },
        button::Status::Disabled => button::Style {
            text_color: Color {
                a: 0.4,
                ..base.text_color
            },
            ..base
        },
        button::Status::Active => base,
    }
}

/// Floating popup surface (context menu).
pub fn popup(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(Color::WHITE)),
        border: Border {
            color: rgb(206, 210, 216),
            width: 1.0,
            radius: 6.0.into(),
        },
        shadow: iced::Shadow {
            color: Color { a: 0.18, ..Color::BLACK },
            offset: iced::Vector::new(0.0, 2.0),
            blur_radius: 12.0,
        },
        ..container::Style::default()
    }
}

/// A single row in a context menu.
pub fn menu_item(theme: &Theme, status: button::Status) -> button::Style {
    let mut s = tool_button(theme, status);
    s.border = Border {
        radius: 4.0.into(),
        ..Border::default()
    };
    s
}

/// A sidebar entry button; highlighted when it points at the current location.
pub fn sidebar_button(current: bool) -> impl Fn(&Theme, button::Status) -> button::Style {
    move |theme, status| {
        let mut s = tool_button(theme, status);
        if current && matches!(status, button::Status::Active) {
            s.background = Some(Background::Color(SELECT_BG));
        }
        s
    }
}
