use iced::widget::{button, container, text};
use iced::{Background, Border, Color, Padding, Shadow, Theme, Vector};

pub const SIDEBAR_WIDTH: f32 = 224.0;
pub const ROW_HEIGHT: f32 = 28.0;
pub const ICON_SIZE: f32 = 18.0;

const BUTTON_RADIUS: f32 = 6.0;

/// Horizontal padding for both the header and the entry rows. The right side is
/// wider than the left to leave a gutter for the overlaid scrollbar.
pub const ROW_PADDING: Padding = Padding {
    top: 0.0,
    right: 18.0,
    bottom: 0.0,
    left: 12.0,
};

// Details-view column widths (Name takes the remaining space).
pub const COL_MODIFIED: f32 = 150.0;
pub const COL_TYPE: f32 = 130.0;
pub const COL_SIZE: f32 = 90.0;

/// System accent blue (works on both light and dark).
pub const ACCENT: Color = Color { r: 0.039, g: 0.518, b: 1.0, a: 1.0 };

/// The theme-dependent color set.
#[derive(Clone, Copy)]
struct Colors {
    text: Color,
    text_dim: Color,
    panel: Color,
    sidebar_bg: Color,
    border: Color,
    select_bg: Color,
    select_bg_strong: Color,
    hover_bg: Color,
    pressed_bg: Color,
    popup_bg: Color,
    spotlight_bg: Color,
    spotlight_border: Color,
}

const LIGHT: Colors = Colors {
    text: Color { r: 0.114, g: 0.114, b: 0.122, a: 1.0 },
    text_dim: Color { r: 0.42, g: 0.42, b: 0.45, a: 1.0 },
    panel: Color { r: 0.967, g: 0.971, b: 0.978, a: 1.0 },
    sidebar_bg: Color { r: 0.960, g: 0.965, b: 0.973, a: 1.0 },
    border: Color { r: 0.886, g: 0.894, b: 0.910, a: 1.0 },
    select_bg: Color { r: 0.039, g: 0.518, b: 1.0, a: 0.15 },
    select_bg_strong: Color { r: 0.039, g: 0.518, b: 1.0, a: 0.24 },
    hover_bg: Color { r: 0.0, g: 0.0, b: 0.0, a: 0.05 },
    pressed_bg: Color { r: 0.0, g: 0.0, b: 0.0, a: 0.10 },
    popup_bg: Color { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
    spotlight_bg: Color { r: 0.98, g: 0.98, b: 0.99, a: 0.94 },
    spotlight_border: Color { r: 0.6, g: 0.62, b: 0.66, a: 0.5 },
};

const DARK: Colors = Colors {
    text: Color { r: 0.94, g: 0.94, b: 0.96, a: 1.0 },
    text_dim: Color { r: 0.62, g: 0.62, b: 0.66, a: 1.0 },
    panel: Color { r: 0.16, g: 0.16, b: 0.17, a: 1.0 },
    sidebar_bg: Color { r: 0.13, g: 0.13, b: 0.14, a: 1.0 },
    border: Color { r: 0.26, g: 0.26, b: 0.28, a: 1.0 },
    select_bg: Color { r: 0.039, g: 0.518, b: 1.0, a: 0.30 },
    select_bg_strong: Color { r: 0.039, g: 0.518, b: 1.0, a: 0.42 },
    hover_bg: Color { r: 1.0, g: 1.0, b: 1.0, a: 0.07 },
    pressed_bg: Color { r: 1.0, g: 1.0, b: 1.0, a: 0.13 },
    popup_bg: Color { r: 0.18, g: 0.18, b: 0.19, a: 1.0 },
    spotlight_bg: Color { r: 0.16, g: 0.16, b: 0.18, a: 0.96 },
    spotlight_border: Color { r: 0.4, g: 0.42, b: 0.46, a: 0.6 },
};

fn colors(theme: &Theme) -> Colors {
    if theme.extended_palette().is_dark {
        DARK
    } else {
        LIGHT
    }
}

/// Text style for secondary/dimmed labels (theme-aware).
pub fn dim_text(theme: &Theme) -> text::Style {
    text::Style {
        color: Some(colors(theme).text_dim),
    }
}

/// Style for a file-list row given its selection state.
pub fn row(selected: bool) -> impl Fn(&Theme) -> container::Style {
    move |theme| {
        if selected {
            container::Style {
                background: Some(Background::Color(colors(theme).select_bg)),
                border: Border {
                    radius: BUTTON_RADIUS.into(),
                    ..Border::default()
                },
                ..container::Style::default()
            }
        } else {
            container::Style::default()
        }
    }
}

/// Header band above the file list (bottom hairline separator).
pub fn header(theme: &Theme) -> container::Style {
    let c = colors(theme);
    container::Style {
        background: Some(Background::Color(c.panel)),
        text_color: Some(c.text_dim),
        border: Border {
            color: c.border,
            width: 1.0,
            radius: 0.0.into(),
        },
        ..container::Style::default()
    }
}

/// The left navigation panel background.
pub fn sidebar(theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(colors(theme).sidebar_bg)),
        ..container::Style::default()
    }
}

/// Toolbar / command bar / status bar band.
pub fn band(theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(colors(theme).panel)),
        ..container::Style::default()
    }
}

/// A subtle, borderless button (toolbar, sidebar entries, menu items).
pub fn tool_button(theme: &Theme, status: button::Status) -> button::Style {
    let c = colors(theme);
    let base = button::Style {
        background: None,
        text_color: c.text,
        border: Border {
            radius: BUTTON_RADIUS.into(),
            ..Border::default()
        },
        ..button::Style::default()
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(c.hover_bg)),
            ..base
        },
        button::Status::Pressed => button::Style {
            background: Some(Background::Color(c.pressed_bg)),
            ..base
        },
        button::Status::Disabled => button::Style {
            text_color: Color { a: 0.35, ..base.text_color },
            ..base
        },
        button::Status::Active => base,
    }
}

/// A sidebar/selectable entry button; tinted with the accent when `current`.
pub fn sidebar_button(current: bool) -> impl Fn(&Theme, button::Status) -> button::Style {
    move |theme, status| {
        if !current {
            return tool_button(theme, status);
        }
        let c = colors(theme);
        let bg = match status {
            button::Status::Hovered | button::Status::Pressed => c.select_bg_strong,
            _ => c.select_bg,
        };
        button::Style {
            background: Some(Background::Color(bg)),
            text_color: ACCENT,
            border: Border {
                radius: BUTTON_RADIUS.into(),
                ..Border::default()
            },
            ..button::Style::default()
        }
    }
}

/// A single row in a context menu.
pub fn menu_item(theme: &Theme, status: button::Status) -> button::Style {
    tool_button(theme, status)
}

/// Floating popup surface (context menu, modals).
pub fn popup(theme: &Theme) -> container::Style {
    let c = colors(theme);
    container::Style {
        background: Some(Background::Color(c.popup_bg)),
        text_color: Some(c.text),
        border: Border {
            color: c.border,
            width: 1.0,
            radius: 10.0.into(),
        },
        shadow: Shadow {
            color: Color { a: 0.16, ..Color::BLACK },
            offset: Vector::new(0.0, 4.0),
            blur_radius: 16.0,
        },
        ..container::Style::default()
    }
}

/// Translucent, rounded surface for the borderless Spotlight window.
pub fn spotlight(theme: &Theme) -> container::Style {
    let c = colors(theme);
    container::Style {
        background: Some(Background::Color(c.spotlight_bg)),
        text_color: Some(c.text),
        border: Border {
            color: c.spotlight_border,
            width: 1.0,
            radius: 16.0.into(),
        },
        shadow: Shadow {
            color: Color { a: 0.28, ..Color::BLACK },
            offset: Vector::new(0.0, 8.0),
            blur_radius: 30.0,
        },
        ..container::Style::default()
    }
}

/// Dimmed full-screen backdrop behind a modal.
pub fn backdrop(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(Color { r: 0.0, g: 0.0, b: 0.0, a: 0.30 })),
        ..container::Style::default()
    }
}

/// Accent-filled primary button (used for prominent actions).
pub fn primary_button(_theme: &Theme, status: button::Status) -> button::Style {
    let base = button::Style {
        background: Some(Background::Color(ACCENT)),
        text_color: Color::WHITE,
        border: Border {
            radius: BUTTON_RADIUS.into(),
            ..Border::default()
        },
        ..button::Style::default()
    };
    match status {
        button::Status::Hovered => button::Style {
            background: Some(Background::Color(Color { a: 0.9, ..ACCENT })),
            ..base
        },
        button::Status::Pressed => button::Style {
            background: Some(Background::Color(Color { a: 0.8, ..ACCENT })),
            ..base
        },
        button::Status::Disabled => button::Style {
            background: Some(Background::Color(Color { a: 0.4, ..ACCENT })),
            ..base
        },
        button::Status::Active => base,
    }
}

/// Progress bar track (background).
pub fn progress_track(theme: &Theme) -> container::Style {
    let c = colors(theme);
    container::Style {
        background: Some(Background::Color(Color { a: 0.12, ..c.text_dim })),
        border: Border {
            radius: 2.0.into(),
            ..Border::default()
        },
        ..container::Style::default()
    }
}

/// Progress bar fill (accent-colored).
pub fn progress_bar(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(ACCENT)),
        border: Border {
            radius: 2.0.into(),
            ..Border::default()
        },
        ..container::Style::default()
    }
}
