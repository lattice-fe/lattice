use std::sync::OnceLock;

use iced::widget::svg;

use crate::fs::EntryKind;

// A folder glyph (Explorer-yellow).
const FOLDER: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<path d="M2 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" fill="#F6C544"/>
<path d="M2 8h20v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z" fill="#FFD65C"/>
</svg>"##;

// A drive/disk glyph.
const DRIVE: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<rect x="2" y="6" width="20" height="12" rx="2" fill="#B8C0CC"/>
<rect x="2" y="6" width="20" height="6" rx="2" fill="#CBD3DE"/>
<circle cx="18" cy="15" r="1.5" fill="#5A6472"/>
</svg>"##;

/// Build a generic page glyph with a coloured accent stripe for a category.
fn page(accent: &str) -> String {
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#FFFFFF" stroke="#C4CAD3" stroke-width="1"/>
<path d="M14 2l6 6h-6V2z" fill="#DCE1E8"/>
<rect x="7" y="12" width="10" height="2.2" rx="1.1" fill="{accent}"/>
<rect x="7" y="16" width="7" height="2.2" rx="1.1" fill="{accent}" opacity="0.55"/>
</svg>"##
    )
}

struct Icons {
    folder: svg::Handle,
    drive: svg::Handle,
    image: svg::Handle,
    audio: svg::Handle,
    video: svg::Handle,
    archive: svg::Handle,
    document: svg::Handle,
    code: svg::Handle,
    executable: svg::Handle,
    other: svg::Handle,
}

fn handle(s: impl Into<Vec<u8>>) -> svg::Handle {
    svg::Handle::from_memory(s.into())
}

fn icons() -> &'static Icons {
    static ICONS: OnceLock<Icons> = OnceLock::new();
    ICONS.get_or_init(|| Icons {
        folder: handle(FOLDER.as_bytes().to_vec()),
        drive: handle(DRIVE.as_bytes().to_vec()),
        image: handle(page("#3AAF5C").into_bytes()),
        audio: handle(page("#B15DD8").into_bytes()),
        video: handle(page("#E0663B").into_bytes()),
        archive: handle(page("#C9922E").into_bytes()),
        document: handle(page("#3A7BD5").into_bytes()),
        code: handle(page("#5A6472").into_bytes()),
        executable: handle(page("#D64550").into_bytes()),
        other: handle(page("#9AA4B0").into_bytes()),
    })
}

// --- Monochrome line glyphs (recolored per tone by the svg widget) ---
// White strokes so iced's `svg` color filter maps cleanly to the tone color.
fn mono(inner: &str) -> String {
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>"##
    )
}

struct MonoIcons {
    folder: svg::Handle,
    drive: svg::Handle,
    image: svg::Handle,
    audio: svg::Handle,
    video: svg::Handle,
    archive: svg::Handle,
    document: svg::Handle,
    code: svg::Handle,
    executable: svg::Handle,
    other: svg::Handle,
}

fn mono_icons() -> &'static MonoIcons {
    static M: OnceLock<MonoIcons> = OnceLock::new();
    M.get_or_init(|| MonoIcons {
        folder: handle(mono(r#"<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>"#).into_bytes()),
        drive: handle(mono(r#"<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01"/>"#).into_bytes()),
        image: handle(mono(r#"<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/>"#).into_bytes()),
        audio: handle(mono(r#"<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>"#).into_bytes()),
        video: handle(mono(r#"<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/>"#).into_bytes()),
        archive: handle(mono(r#"<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>"#).into_bytes()),
        document: handle(mono(r#"<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>"#).into_bytes()),
        code: handle(mono(r#"<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>"#).into_bytes()),
        executable: handle(mono(r#"<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m8 9 3 3-3 3M13 15h3"/>"#).into_bytes()),
        other: handle(mono(r#"<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>"#).into_bytes()),
    })
}

/// Monochrome glyph for an entry category — meant to be tinted and set inside a
/// tone-coloured tile (see [`crate::ui::style::tile`]).
pub fn for_kind_mono(kind: EntryKind) -> svg::Handle {
    let i = mono_icons();
    match kind {
        EntryKind::Folder => i.folder.clone(),
        EntryKind::Drive => i.drive.clone(),
        EntryKind::Image => i.image.clone(),
        EntryKind::Audio => i.audio.clone(),
        EntryKind::Video => i.video.clone(),
        EntryKind::Archive => i.archive.clone(),
        EntryKind::Document => i.document.clone(),
        EntryKind::Code => i.code.clone(),
        EntryKind::Executable => i.executable.clone(),
        EntryKind::Other => i.other.clone(),
    }
}

/// The icon handle for a given entry category.
pub fn for_kind(kind: EntryKind) -> svg::Handle {
    let i = icons();
    match kind {
        EntryKind::Folder => i.folder.clone(),
        EntryKind::Drive => i.drive.clone(),
        EntryKind::Image => i.image.clone(),
        EntryKind::Audio => i.audio.clone(),
        EntryKind::Video => i.video.clone(),
        EntryKind::Archive => i.archive.clone(),
        EntryKind::Document => i.document.clone(),
        EntryKind::Code => i.code.clone(),
        EntryKind::Executable => i.executable.clone(),
        EntryKind::Other => i.other.clone(),
    }
}
