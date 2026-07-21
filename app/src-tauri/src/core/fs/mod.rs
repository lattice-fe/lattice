pub mod entry;
pub mod ops;
pub mod platform;
pub mod scan;

#[cfg(windows)]
pub mod windows;

pub use entry::{Entry, EntryKind};
pub use platform::{current as current_platform, Drive, Platform, Shortcut};
pub use scan::{scan_dir_async, scan_subdirs_async};
