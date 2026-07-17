use std::path::PathBuf;

use iced::keyboard::Modifiers;
use iced::Point;

use crate::fs::Entry;
use crate::sort::SortColumn;

#[derive(Debug, Clone)]
pub enum Message {
    // Navigation
    Navigate(PathBuf),
    GoBack,
    GoForward,
    GoUp,
    Refresh,

    // Async results
    DirLoaded {
        path: PathBuf,
        result: Result<Vec<Entry>, String>,
    },
    SubdirsLoaded {
        path: PathBuf,
        result: Result<Vec<Entry>, String>,
    },

    // Selection
    EntryPressed(usize),
    BackgroundPressed,
    SelectAll,

    // Sorting
    SortBy(SortColumn),

    // Address bar
    AddressEditStart,
    AddressChanged(String),
    AddressSubmit,

    // View options
    ToggleHidden,

    // Sidebar
    SidebarToggleExpand(PathBuf),

    // File operations
    Copy,
    Cut,
    Paste,
    DeleteSelected,
    NewFolder,
    RenameStart(usize),
    RenameSelected,
    RenameChanged(String),
    RenameSubmit,
    ActivateEntry(usize),
    OpDone(Result<(), String>),

    // Context menu
    CursorMoved(Point),
    EntryRightPressed(usize),
    BackgroundRightPressed,
    ContextClose,

    // Input state / shortcuts
    ModifiersChanged(Modifiers),
    KeyActivate,
    EscapePressed,
}
