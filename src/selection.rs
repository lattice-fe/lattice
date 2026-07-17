use std::collections::BTreeSet;

/// Multi-selection over the current file list, tracked by row index. Keeps an
/// anchor so Shift-click can select a contiguous range like Explorer does.
#[derive(Debug, Default, Clone)]
pub struct Selection {
    indices: BTreeSet<usize>,
    anchor: Option<usize>,
}

impl Selection {
    pub fn clear(&mut self) {
        self.indices.clear();
        self.anchor = None;
    }

    pub fn is_empty(&self) -> bool {
        self.indices.is_empty()
    }

    pub fn len(&self) -> usize {
        self.indices.len()
    }

    pub fn contains(&self, index: usize) -> bool {
        self.indices.contains(&index)
    }

    pub fn indices(&self) -> impl Iterator<Item = usize> + '_ {
        self.indices.iter().copied()
    }

    /// Plain click: select only this row and set it as the anchor.
    pub fn select_one(&mut self, index: usize) {
        self.indices.clear();
        self.indices.insert(index);
        self.anchor = Some(index);
    }

    /// Ctrl-click: toggle this row, moving the anchor to it.
    pub fn toggle(&mut self, index: usize) {
        if !self.indices.insert(index) {
            self.indices.remove(&index);
        }
        self.anchor = Some(index);
    }

    /// Shift-click: select the contiguous range from the anchor to this row.
    /// If there's no anchor yet, behaves like a plain click.
    pub fn select_range(&mut self, index: usize) {
        let anchor = match self.anchor {
            Some(a) => a,
            None => {
                self.select_one(index);
                return;
            }
        };
        let (lo, hi) = if anchor <= index {
            (anchor, index)
        } else {
            (index, anchor)
        };
        self.indices.clear();
        self.indices.extend(lo..=hi);
        // Anchor stays put so successive Shift-clicks pivot around it.
    }

    /// Select every row in a list of `count` items.
    pub fn select_all(&mut self, count: usize) {
        self.indices.clear();
        self.indices.extend(0..count);
        self.anchor = Some(0);
    }

    /// The single selected index, if exactly one row is selected.
    pub fn single(&self) -> Option<usize> {
        if self.indices.len() == 1 {
            self.indices.iter().next().copied()
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn select_one_replaces() {
        let mut s = Selection::default();
        s.select_one(2);
        s.select_one(5);
        assert!(s.contains(5));
        assert!(!s.contains(2));
        assert_eq!(s.len(), 1);
    }

    #[test]
    fn toggle_adds_and_removes() {
        let mut s = Selection::default();
        s.toggle(1);
        s.toggle(3);
        assert_eq!(s.len(), 2);
        s.toggle(1);
        assert!(!s.contains(1));
        assert_eq!(s.len(), 1);
    }

    #[test]
    fn range_from_anchor_both_directions() {
        let mut s = Selection::default();
        s.select_one(2);
        s.select_range(5);
        assert_eq!(s.indices().collect::<Vec<_>>(), vec![2, 3, 4, 5]);
        // Pivot back around the same anchor.
        s.select_range(0);
        assert_eq!(s.indices().collect::<Vec<_>>(), vec![0, 1, 2]);
    }

    #[test]
    fn range_without_anchor_is_single() {
        let mut s = Selection::default();
        s.select_range(4);
        assert_eq!(s.indices().collect::<Vec<_>>(), vec![4]);
    }
}
