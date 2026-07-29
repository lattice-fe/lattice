use std::path::Path;

use super::walk::DocKind;

/// Maximum bytes we scan when sniffing for binary content.
const SNIFF_BYTES: usize = 8192;

/// Extract plain text from a file according to its [`DocKind`].
pub fn extract(path: &Path, kind: DocKind) -> Result<String, String> {
    match kind {
        DocKind::Text => extract_text_file(path),
        DocKind::Pdf => extract_pdf(path),
    }
}

fn extract_text_file(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    // A NUL byte in the head is a strong signal this isn't really text.
    if bytes.iter().take(SNIFF_BYTES).any(|b| *b == 0) {
        return Err("looks binary".to_string());
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn extract_pdf(path: &Path) -> Result<String, String> {
    // pdf-extract handles text PDFs; scanned/image PDFs yield little or nothing.
    pdf_extract::extract_text(path).map_err(|e| format!("pdf: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_utf8_text() {
        let tmp = std::env::temp_dir().join(format!("lattice-extract-{}.txt", std::process::id()));
        std::fs::write(&tmp, "hello, world\nsecond line").unwrap();
        let out = extract(&tmp, DocKind::Text).unwrap();
        assert!(out.contains("second line"));
        let _ = std::fs::remove_file(&tmp);
    }

    #[test]
    fn rejects_binary_disguised_as_text() {
        let tmp = std::env::temp_dir().join(format!("lattice-bin-{}.txt", std::process::id()));
        std::fs::write(&tmp, [b'a', 0u8, b'b', b'c']).unwrap();
        assert!(extract(&tmp, DocKind::Text).is_err());
        let _ = std::fs::remove_file(&tmp);
    }
}
