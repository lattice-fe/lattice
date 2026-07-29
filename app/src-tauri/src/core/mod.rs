//! UI-agnostic core carried over from the iced app: filesystem model + ops,
//! platform drives/shortcuts, sorting, and formatting. Wired to Tauri commands
//! in later phases.
pub mod fs;
pub mod format;
pub mod sort;
pub mod index;
