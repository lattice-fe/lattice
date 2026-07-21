/// A slice of a document's text, tracked by character offsets so we can later
/// jump back to the exact location in the file.
#[derive(Debug, Clone)]
pub struct Chunk {
    pub ordinal: usize,
    pub char_start: usize,
    pub char_end: usize,
    pub text: String,
}

pub const CHUNK_CHARS: usize = 1200;
pub const OVERLAP_CHARS: usize = 150;
/// How far back from a chunk's hard end we'll look for a newline to break on.
const BREAK_WINDOW: usize = 200;

/// Split `text` into overlapping chunks, preferring to break on line boundaries.
/// Offsets are in `char`s (not bytes) so multi-byte content stays correct.
pub fn chunk_text(text: &str) -> Vec<Chunk> {
    let chars: Vec<char> = text.chars().collect();
    let n = chars.len();
    if n == 0 {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut start = 0usize;
    let mut ordinal = 0usize;

    while start < n {
        let hard_end = (start + CHUNK_CHARS).min(n);
        let end = if hard_end < n {
            find_line_break(&chars, start, hard_end).unwrap_or(hard_end)
        } else {
            hard_end
        };

        let slice: String = chars[start..end].iter().collect();
        if !slice.trim().is_empty() {
            chunks.push(Chunk {
                ordinal,
                char_start: start,
                char_end: end,
                text: slice,
            });
            ordinal += 1;
        }

        if end >= n {
            break;
        }
        // Advance with overlap, but always make forward progress.
        let next = end.saturating_sub(OVERLAP_CHARS);
        start = if next > start { next } else { end };
    }

    chunks
}

/// Find a newline to break on within the last `BREAK_WINDOW` chars before
/// `hard_end`, returning the index just past it. `None` if there isn't one.
fn find_line_break(chars: &[char], start: usize, hard_end: usize) -> Option<usize> {
    let lower = hard_end.saturating_sub(BREAK_WINDOW).max(start + 1);
    (lower..hard_end)
        .rev()
        .find(|&i| chars[i] == '\n')
        .map(|i| i + 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_and_blank_produce_no_chunks() {
        assert!(chunk_text("").is_empty());
        assert!(chunk_text("   \n\t  \n ").is_empty());
    }

    #[test]
    fn short_text_is_a_single_chunk() {
        let t = "hello world";
        let chunks = chunk_text(t);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].char_start, 0);
        assert_eq!(chunks[0].char_end, t.chars().count());
        assert_eq!(chunks[0].text, t);
    }

    #[test]
    fn long_text_chunks_cover_with_valid_offsets() {
        // ~6k chars across many lines.
        let line = "the quick brown fox jumps over the lazy dog\n";
        let text = line.repeat(140);
        let chars: Vec<char> = text.chars().collect();
        let chunks = chunk_text(&text);

        assert!(chunks.len() > 1, "expected multiple chunks");
        assert_eq!(chunks.first().unwrap().char_start, 0);
        assert_eq!(chunks.last().unwrap().char_end, chars.len());

        let mut prev_start = None;
        for c in &chunks {
            // Offsets are in range and reproduce the chunk text exactly.
            assert!(c.char_end <= chars.len());
            assert!(c.char_start < c.char_end);
            let slice: String = chars[c.char_start..c.char_end].iter().collect();
            assert_eq!(slice, c.text);
            assert!(c.char_end - c.char_start <= CHUNK_CHARS);
            // Starts strictly increase (forward progress).
            if let Some(p) = prev_start {
                assert!(c.char_start > p, "starts must increase");
            }
            prev_start = Some(c.char_start);
        }
    }

    #[test]
    fn multibyte_offsets_are_char_based() {
        let text = "café☕ résumé ".repeat(200);
        let chars: Vec<char> = text.chars().collect();
        for c in chunk_text(&text) {
            let slice: String = chars[c.char_start..c.char_end].iter().collect();
            assert_eq!(slice, c.text);
        }
    }
}
