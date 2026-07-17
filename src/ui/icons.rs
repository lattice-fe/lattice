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
