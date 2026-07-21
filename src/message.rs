use std::path::PathBuf;
use std::sync::mpsc::Sender;

use iced::keyboard::Modifiers;
use iced::Point;

use crate::fs::Entry;
use crate::index::{Command, Event, SearchMode};
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

    // Indexer / search
    IndexerReady(Sender<Command>),
    Indexer(Event),
    IndexCurrentFolder,
    FocusSearch,
    SearchInput(String),
    SearchSubmit,
    SearchClear,
    SearchModeChanged(SearchMode),
    OpenResult(PathBuf),

    // Collections management
    CollectionsOpen,
    CollectionsClose,
    CollectionRemove(i64),
    CollectionReindex(i64),
    CollectionSemantic(i64, bool),
    SpinTick,

    // Settings
    SettingsOpen,
    SettingsClose,
    ToggleDarkMode,

    // RAG "Open with Index"
    OpenWithIndex(usize),
    RagReadyToOpen(bool),
    RagIndexStarted {
        path: String,
        result: Result<String, String>,
    },
    RagPollTick,
    RagProgress(Result<(usize, usize), String>),
    RagOpenBrowser,
    RagModalBackground,
    RagModalDismiss,

    // Windows / launcher / tray
    ToggleSpotlight,
    ShowMainWindow,
    QuitApp,
    WindowCloseRequested(iced::window::Id),
    WindowUnfocused(iced::window::Id),

    // Input state / shortcuts
    ModifiersChanged(Modifiers),
    KeyActivate,
    EscapePressed,
}
