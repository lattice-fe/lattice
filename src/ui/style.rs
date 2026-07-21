use std::sync::LazyLock;

use iced::font::Weight;
use iced::theme::Palette;
use iced::widget::{button, container, scrollable, text};
use iced::{Background, Border, Color, Font, Padding, Shadow, Theme, Vector};

use crate::fs::EntryKind;

pub const SIDEBAR_WIDTH: f32 = 224.0;
pub const ROW_HEIGHT: f32 = 34.0;

const BUTTON_RADIUS: f32 = 6.0;

// --- Brand typography (vendored OFL fonts, loaded in main.rs) ---
/// Body / UI text — the default face.
pub const BODY: Font = Font::with_name("Inter");
/// Inter, semibold — for headings and emphasis.
pub const BODY_SEMIBOLD: Font = Font { weight: Weight::Semibold, ..Font::with_name("Inter") };
/// Monospace for counts, sizes, and code-ish metadata.
pub const MONO: Font = Font::with_name("JetBrains Mono");

/// rgb8 helper for the brand palette (const-friendly).
const fn rgb(r: u8, g: u8, b: u8) -> Color {
    Color { r: r as f32 / 255.0, g: g as f32 / 255.0, b: b as f32 / 255.0, a: 1.0 }
}
const fn rgba(r: u8, g: u8, b: u8, a: f32) -> Color {
    Color { r: r as f32 / 255.0, g: g as f32 / 255.0, b: b as f32 / 255.0, a }
}

// --- Brand palette (Lattice identity) ---
pub const INK: Color = rgb(0x1A, 0x18, 0x15);
pub const PAPER: Color = rgb(0xF4, 0xEE, 0xE2);
/// Primary brand accent — the lattice.
pub const ACCENT: Color = rgb(0xC0, 0x5F, 0x3C); // terracotta
/// The "search hit" highlight.
pub const AMBER: Color = rgb(0xE2, 0xA6, 0x4C);
/// Secondary / calm-action accent.
pub const TEAL: Color = rgb(0x4F, 0x9A, 0x8A);

/// The Lattice brand themes. Custom `Theme`s so the window/content background is
/// ink (dark) or paper (light) rather than iced's stock greys.
static INK_THEME: LazyLock<Theme> = LazyLock::new(|| {
    Theme::custom(
        "Lattice Ink".to_string(),
        Palette { background: INK, text: PAPER, primary: ACCENT, success: TEAL, warning: AMBER, danger: rgb(0xC0, 0x50, 0x3C) },
    )
});
static PAPER_THEME: LazyLock<Theme> = LazyLock::new(|| {
    Theme::custom(
        "Lattice Paper".to_string(),
        Palette { background: rgb(0xFB, 0xF8, 0xF1), text: rgb(0x23, 0x20, 0x1B), primary: ACCENT, success: TEAL, warning: AMBER, danger: rgb(0xB2, 0x3A, 0x2C) },
    )
});

pub fn ink_theme() -> Theme {
    INK_THEME.clone()
}
pub fn paper_theme() -> Theme {
    PAPER_THEME.clone()
}

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

// Paper (light) — warm cream ground, ink text, terracotta accents.
const LIGHT: Colors = Colors {
    text: rgb(0x23, 0x20, 0x1B),
    text_dim: rgb(0x6C, 0x63, 0x56),
    panel: rgb(0xF1, 0xEA, 0xDC),
    sidebar_bg: rgb(0xEF, 0xE8, 0xDA),
    border: rgb(0xE4, 0xDA, 0xC7),
    select_bg: rgba(0xC0, 0x5F, 0x3C, 0.14),
    select_bg_strong: rgba(0xC0, 0x5F, 0x3C, 0.22),
    hover_bg: rgba(0x23, 0x20, 0x1B, 0.05),
    pressed_bg: rgba(0x23, 0x20, 0x1B, 0.10),
    popup_bg: rgb(0xFB, 0xF8, 0xF1),
    spotlight_bg: rgba(0xFB, 0xF8, 0xF1, 0.96),
    spotlight_border: rgba(0xC9, 0xBD, 0xA9, 0.6),
};

// Ink (dark) — near-black warm ground, paper text, terracotta/amber accents.
const DARK: Colors = Colors {
    text: rgb(0xF4, 0xEE, 0xE2),
    text_dim: rgb(0x9A, 0x91, 0x7F),
    panel: rgb(0x20, 0x1D, 0x19),
    sidebar_bg: rgb(0x1D, 0x1A, 0x16),
    border: rgb(0x2F, 0x2A, 0x24),
    select_bg: rgba(0xC0, 0x5F, 0x3C, 0.16),
    select_bg_strong: rgba(0xC0, 0x5F, 0x3C, 0.30),
    hover_bg: rgba(0xF4, 0xEE, 0xE2, 0.05),
    pressed_bg: rgba(0xF4, 0xEE, 0xE2, 0.10),
    popup_bg: rgb(0x20, 0x1D, 0x19),
    spotlight_bg: rgba(0x1A, 0x18, 0x15, 0.96),
    spotlight_border: rgba(0x34, 0x2E, 0x27, 0.7),
};

fn colors(theme: &Theme) -> Colors {
    if theme.extended_palette().is_dark {
        DARK
    } else {
        LIGHT
    }
}

/// Per-category icon tone — `(tile background, glyph color)`, theme-aware.
/// Gives each file kind a soft coloured tile like the redesign mockup.
pub fn tone(kind: EntryKind, theme: &Theme) -> (Color, Color) {
    let dark = theme.extended_palette().is_dark;
    // category selector
    enum T { Amber, Terra, Slate, Green, Rose, Violet }
    let cat = match kind {
        EntryKind::Folder | EntryKind::Archive => T::Amber,
        EntryKind::Code => T::Terra,
        EntryKind::Image => T::Green,
        EntryKind::Audio => T::Violet,
        EntryKind::Video => T::Rose,
        EntryKind::Executable => T::Rose,
        EntryKind::Document | EntryKind::Drive | EntryKind::Other => T::Slate,
    };
    match (cat, dark) {
        (T::Amber, true) => (rgb(0x33, 0x26, 0x0F), rgb(0xE2, 0xA6, 0x4C)),
        (T::Amber, false) => (rgb(0xFE, 0xF4, 0xE3), rgb(0xD9, 0x77, 0x06)),
        (T::Terra, true) => (rgb(0x33, 0x1F, 0x14), rgb(0xD8, 0x79, 0x4A)),
        (T::Terra, false) => (rgb(0xFE, 0xEE, 0xE2), rgb(0xEA, 0x58, 0x0C)),
        (T::Slate, true) => (rgb(0x26, 0x22, 0x1D), rgb(0xA9, 0x9F, 0x8E)),
        (T::Slate, false) => (rgb(0xEC, 0xE7, 0xDC), rgb(0x83, 0x78, 0x66)),
        (T::Green, true) => (rgb(0x22, 0x27, 0x1F), rgb(0x9D, 0xB9, 0x8A)),
        (T::Green, false) => (rgb(0xE6, 0xF6, 0xEE), rgb(0x05, 0x96, 0x69)),
        (T::Rose, true) => (rgb(0x30, 0x1C, 0x1A), rgb(0xCF, 0x6F, 0x5B)),
        (T::Rose, false) => (rgb(0xFE, 0xEC, 0xEF), rgb(0xE1, 0x1D, 0x48)),
        (T::Violet, true) => (rgb(0x28, 0x21, 0x32), rgb(0xB1, 0x99, 0xD6)),
        (T::Violet, false) => (rgb(0xF1, 0xEA, 0xFE), rgb(0x7C, 0x3A, 0xED)),
    }
}

/// A rounded, tone-tinted tile behind a file's glyph.
pub fn tile(kind: EntryKind, radius: f32) -> impl Fn(&Theme) -> container::Style {
    move |theme| container::Style {
        background: Some(Background::Color(tone(kind, theme).0)),
        border: Border { radius: radius.into(), ..Border::default() },
        ..container::Style::default()
    }
}

/// Teal "calm action" button (the inspector's Open) — the palette `success` hue.
pub fn success_button(_theme: &Theme, status: button::Status) -> button::Style {
    let base = button::Style {
        background: Some(Background::Color(TEAL)),
        text_color: PAPER,
        border: Border { radius: 10.0.into(), ..Border::default() },
        ..button::Style::default()
    };
    match status {
        button::Status::Hovered => button::Style { background: Some(Background::Color(Color { a: 0.88, ..TEAL })), ..base },
        button::Status::Pressed => button::Style { background: Some(Background::Color(Color { a: 0.78, ..TEAL })), ..base },
        button::Status::Disabled => button::Style { background: Some(Background::Color(Color { a: 0.4, ..TEAL })), ..base },
        button::Status::Active => base,
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

/// An overlay-style scrollbar that only shows its thumb on hover/drag, so the
/// content isn't framed by a permanent rail.
pub fn scrollbar(theme: &Theme, status: scrollable::Status) -> scrollable::Style {
    let c = colors(theme);
    let visible = matches!(
        status,
        scrollable::Status::Hovered { .. } | scrollable::Status::Dragged { .. }
    );
    let scroller_color = if visible {
        Color { a: 0.5, ..c.text_dim }
    } else {
        Color::TRANSPARENT
    };
    let rail = scrollable::Rail {
        background: None,
        border: Border::default(),
        scroller: scrollable::Scroller {
            background: Background::Color(scroller_color),
            border: Border { radius: 4.0.into(), ..Border::default() },
        },
    };
    scrollable::Style {
        container: container::Style::default(),
        vertical_rail: rail,
        horizontal_rail: rail,
        gap: None,
        auto_scroll: scrollable::AutoScroll {
            background: Background::Color(Color { a: 0.92, ..c.panel }),
            border: Border { radius: 100.0.into(), width: 1.0, color: Color { a: 0.5, ..c.text_dim } },
            shadow: Shadow { color: Color { a: 0.4, ..Color::BLACK }, offset: Vector::ZERO, blur_radius: 2.0 },
            icon: c.text_dim,
        },
    }
}

/// The compact search box in the top bar (rounded, bordered pill).
pub fn search_pill(theme: &Theme) -> container::Style {
    let c = colors(theme);
    container::Style {
        background: Some(Background::Color(c.sidebar_bg)),
        text_color: Some(c.text_dim),
        border: Border { color: c.border, width: 1.0, radius: 9.0.into() },
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
