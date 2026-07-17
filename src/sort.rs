use std::cmp::Ordering;

use crate::fs::Entry;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortColumn {
    Name,
    Modified,
    Type,
    Size,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Ascending,
    Descending,
}

impl Direction {
    pub fn toggled(self) -> Direction {
        match self {
            Direction::Ascending => Direction::Descending,
            Direction::Descending => Direction::Ascending,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SortState {
    pub column: SortColumn,
    pub direction: Direction,
}

impl Default for SortState {
    fn default() -> Self {
        SortState {
            column: SortColumn::Name,
            direction: Direction::Ascending,
        }
    }
}

impl SortState {
    /// Clicking a header: if it's already the active column, flip direction;
    /// otherwise switch to it with a sensible default direction.
    pub fn apply_click(&mut self, column: SortColumn) {
        if self.column == column {
            self.direction = self.direction.toggled();
        } else {
            self.column = column;
            // Name/Type default ascending (A→Z); Size/Date default ascending too,
            // matching Explorer's first-click behavior.
            self.direction = Direction::Ascending;
        }
    }
}

/// Sort entries in place. Folders always sort before files (like Explorer),
/// regardless of column or direction; the chosen column orders within each group.
pub fn sort_entries(entries: &mut [Entry], state: SortState) {
    entries.sort_by(|a, b| {
        // Directories first.
        match (a.is_dir, b.is_dir) {
            (true, false) => return Ordering::Less,
            (false, true) => return Ordering::Greater,
            _ => {}
        }
        let ord = compare_column(a, b, state.column);
        match state.direction {
            Direction::Ascending => ord,
            Direction::Descending => ord.reverse(),
        }
    });
}

fn compare_column(a: &Entry, b: &Entry, column: SortColumn) -> Ordering {
    match column {
        SortColumn::Name => name_cmp(a, b),
        SortColumn::Size => a.size.cmp(&b.size).then_with(|| name_cmp(a, b)),
        SortColumn::Modified => a
            .modified
            .cmp(&b.modified)
            .then_with(|| name_cmp(a, b)),
        SortColumn::Type => a
            .type_label()
            .to_lowercase()
            .cmp(&b.type_label().to_lowercase())
            .then_with(|| name_cmp(a, b)),
    }
}

fn name_cmp(a: &Entry, b: &Entry) -> Ordering {
    a.name.to_lowercase().cmp(&b.name.to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fs::EntryKind;
    use std::path::PathBuf;

    fn entry(name: &str, is_dir: bool, size: u64) -> Entry {
        Entry {
            path: PathBuf::from(name),
            name: name.to_string(),
            is_dir,
            size,
            modified: None,
            kind: if is_dir { EntryKind::Folder } else { EntryKind::Other },
            hidden: false,
        }
    }

    #[test]
    fn dirs_before_files_regardless_of_direction() {
        let mut v = vec![
            entry("zeta.txt", false, 1),
            entry("alpha", true, 0),
            entry("beta.txt", false, 5),
        ];
        sort_entries(
            &mut v,
            SortState {
                column: SortColumn::Name,
                direction: Direction::Descending,
            },
        );
        assert_eq!(v[0].name, "alpha"); // dir first even descending
    }

    #[test]
    fn sort_by_size_ascending() {
        let mut v = vec![
            entry("big.bin", false, 100),
            entry("small.bin", false, 1),
            entry("mid.bin", false, 50),
        ];
        sort_entries(
            &mut v,
            SortState {
                column: SortColumn::Size,
                direction: Direction::Ascending,
            },
        );
        let names: Vec<_> = v.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["small.bin", "mid.bin", "big.bin"]);
    }

    #[test]
    fn apply_click_toggles_and_switches() {
        let mut s = SortState::default();
        assert_eq!(s.column, SortColumn::Name);
        s.apply_click(SortColumn::Name);
        assert_eq!(s.direction, Direction::Descending);
        s.apply_click(SortColumn::Size);
        assert_eq!(s.column, SortColumn::Size);
        assert_eq!(s.direction, Direction::Ascending);
    }
}
