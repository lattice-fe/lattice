use std::path::{Path, PathBuf};

/// Back/forward navigation history, mirroring a browser's model: navigating to
/// a new location clears the forward stack.
#[derive(Debug, Clone)]
pub struct History {
    back: Vec<PathBuf>,
    current: PathBuf,
    forward: Vec<PathBuf>,
}

impl History {
    pub fn new(start: PathBuf) -> Self {
        History {
            back: Vec::new(),
            current: start,
            forward: Vec::new(),
        }
    }

    pub fn current(&self) -> &Path {
        &self.current
    }

    pub fn can_go_back(&self) -> bool {
        !self.back.is_empty()
    }

    pub fn can_go_forward(&self) -> bool {
        !self.forward.is_empty()
    }

    /// Navigate to a new location. No-op if it's the same as the current one.
    /// Clears the forward stack.
    pub fn push(&mut self, path: PathBuf) {
        if path == self.current {
            return;
        }
        let prev = std::mem::replace(&mut self.current, path);
        self.back.push(prev);
        self.forward.clear();
    }

    /// Move back one step, returning the new current location.
    pub fn back(&mut self) -> Option<&Path> {
        let prev = self.back.pop()?;
        let old = std::mem::replace(&mut self.current, prev);
        self.forward.push(old);
        Some(&self.current)
    }

    /// Move forward one step, returning the new current location.
    pub fn forward(&mut self) -> Option<&Path> {
        let next = self.forward.pop()?;
        let old = std::mem::replace(&mut self.current, next);
        self.back.push(old);
        Some(&self.current)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(s: &str) -> PathBuf {
        PathBuf::from(s)
    }

    #[test]
    fn push_and_back_forward() {
        let mut h = History::new(p("/a"));
        assert!(!h.can_go_back());
        h.push(p("/b"));
        h.push(p("/c"));
        assert_eq!(h.current(), Path::new("/c"));
        assert!(h.can_go_back());

        assert_eq!(h.back().unwrap(), Path::new("/b"));
        assert_eq!(h.back().unwrap(), Path::new("/a"));
        assert!(h.back().is_none());
        assert!(h.can_go_forward());

        assert_eq!(h.forward().unwrap(), Path::new("/b"));
        assert_eq!(h.current(), Path::new("/b"));
    }

    #[test]
    fn push_clears_forward() {
        let mut h = History::new(p("/a"));
        h.push(p("/b"));
        h.back();
        assert!(h.can_go_forward());
        h.push(p("/z"));
        assert!(!h.can_go_forward());
    }

    #[test]
    fn push_same_is_noop() {
        let mut h = History::new(p("/a"));
        h.push(p("/a"));
        assert!(!h.can_go_back());
    }
}
