use std::collections::BTreeMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use iced::keyboard;
use iced::widget::{column, container, row, rule, stack};
use iced::{Element, Event, Length, Point, Subscription, Task, Theme};

use crate::fs::ops::{self, Clipboard, ClipboardMode};
use crate::fs::{self, Drive, Entry, Platform, Shortcut};
use crate::message::Message;
use crate::navigation::History;
use crate::selection::Selection;
use crate::sort::{sort_entries, SortState};
use crate::ui;
use crate::ui::context::Menu;

const DOUBLE_CLICK: Duration = Duration::from_millis(400);

struct Renaming {
    index: usize,
    value: String,
}

pub struct App {
    platform: Box<dyn Platform>,
    history: History,
    quick_access: Vec<Shortcut>,
    drives: Vec<Drive>,

    all_entries: Vec<Entry>, // unfiltered contents of the current dir
    entries: Vec<Entry>,     // filtered + sorted view (selection indexes into this)
    loading: bool,
    error: Option<String>,
    notice: Option<String>, // transient result of the last file operation

    selection: Selection,
    sort: SortState,
    show_hidden: bool,
    modifiers: keyboard::Modifiers,
    address_edit: Option<String>,
    expanded: BTreeMap<PathBuf, Vec<Entry>>,
    last_click: Option<(usize, Instant)>,

    clipboard: Option<Clipboard>,
    renaming: Option<Renaming>,
    context_menu: Option<Menu>,
    cursor: Point,
    // After creating a folder we reload, then drop into rename mode on this path.
    pending_rename: Option<PathBuf>,
}

impl App {
    pub fn new() -> (Self, Task<Message>) {
        let platform = fs::current_platform();
        let home = platform.home_dir();
        let quick_access = platform.quick_access();
        let drives = platform.drives();

        let app = App {
            platform,
            history: History::new(home.clone()),
            quick_access,
            drives,
            all_entries: Vec::new(),
            entries: Vec::new(),
            loading: true,
            error: None,
            notice: None,
            selection: Selection::default(),
            sort: SortState::default(),
            show_hidden: false,
            modifiers: keyboard::Modifiers::default(),
            address_edit: None,
            expanded: BTreeMap::new(),
            last_click: None,
            clipboard: None,
            renaming: None,
            context_menu: None,
            cursor: Point::ORIGIN,
            pending_rename: None,
        };

        let init = load_dir(home);
        (app, init)
    }

    pub fn title(&self) -> String {
        let here = self
            .history
            .current()
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| self.history.current().display().to_string());
        format!("{here} — Lattice")
    }

    pub fn theme(&self) -> Theme {
        Theme::Light
    }

    pub fn update(&mut self, message: Message) -> Task<Message> {
        let busy = self.address_edit.is_some() || self.renaming.is_some();
        match message {
            Message::Navigate(path) => {
                self.history.push(path);
                self.address_edit = None;
                self.reload()
            }
            Message::GoBack => {
                if busy {
                    return Task::none();
                }
                if self.history.back().is_some() {
                    self.reload()
                } else {
                    Task::none()
                }
            }
            Message::GoForward => {
                if busy {
                    return Task::none();
                }
                if self.history.forward().is_some() {
                    self.reload()
                } else {
                    Task::none()
                }
            }
            Message::GoUp => {
                if busy {
                    return Task::none();
                }
                if let Some(parent) = self.history.current().parent() {
                    let parent = parent.to_path_buf();
                    self.history.push(parent);
                    self.reload()
                } else {
                    Task::none()
                }
            }
            Message::Refresh => {
                if busy {
                    return Task::none();
                }
                self.drives = self.platform.drives();
                self.reload()
            }

            Message::DirLoaded { path, result } => {
                if path != self.history.current() {
                    return Task::none(); // stale load for a folder we've left
                }
                self.loading = false;
                match result {
                    Ok(list) => {
                        self.all_entries = list;
                        self.error = None;
                        self.rebuild();
                        // If we just created a folder, drop into rename mode on it.
                        if let Some(path) = self.pending_rename.take() {
                            if let Some(i) = self.entries.iter().position(|e| e.path == path) {
                                return self.begin_rename(i);
                            }
                        }
                    }
                    Err(e) => {
                        self.all_entries.clear();
                        self.entries.clear();
                        self.error = Some(e);
                    }
                }
                Task::none()
            }
            Message::SubdirsLoaded { path, result } => {
                if !self.expanded.contains_key(&path) {
                    return Task::none(); // collapsed before the scan finished
                }
                if let Ok(mut list) = result {
                    if !self.show_hidden {
                        list.retain(|e| !e.hidden);
                    }
                    self.expanded.insert(path, list);
                }
                Task::none()
            }

            Message::EntryPressed(index) => {
                let now = Instant::now();
                let double = self
                    .last_click
                    .map_or(false, |(i, t)| i == index && now.duration_since(t) < DOUBLE_CLICK);
                self.last_click = Some((index, now));

                if self.modifiers.control() {
                    self.selection.toggle(index);
                } else if self.modifiers.shift() {
                    self.selection.select_range(index);
                } else {
                    self.selection.select_one(index);
                }

                if double {
                    return self.activate(index);
                }
                Task::none()
            }
            Message::BackgroundPressed => {
                self.selection.clear();
                self.last_click = None;
                Task::none()
            }
            Message::SelectAll => {
                if busy {
                    return Task::none();
                }
                self.selection.select_all(self.entries.len());
                Task::none()
            }
            Message::KeyActivate => {
                if busy {
                    return Task::none();
                }
                if let Some(i) = self.selection.single() {
                    return self.activate(i);
                }
                Task::none()
            }

            Message::SortBy(column) => {
                self.sort.apply_click(column);
                self.rebuild();
                Task::none()
            }

            Message::AddressEditStart => {
                self.address_edit = Some(self.history.current().display().to_string());
                iced::widget::operation::focus(ui::breadcrumb::ADDRESS_ID)
            }
            Message::AddressChanged(value) => {
                if let Some(buf) = self.address_edit.as_mut() {
                    *buf = value;
                }
                Task::none()
            }
            Message::AddressSubmit => {
                if let Some(value) = self.address_edit.take() {
                    let path = PathBuf::from(value.trim());
                    if path.is_dir() {
                        self.history.push(path);
                        return self.reload();
                    } else {
                        self.error = Some(format!("Can't find '{}'", path.display()));
                    }
                }
                Task::none()
            }
            Message::EscapePressed => {
                if self.renaming.is_some() {
                    self.renaming = None;
                } else if self.address_edit.is_some() {
                    self.address_edit = None;
                } else if self.context_menu.is_some() {
                    self.context_menu = None;
                } else {
                    self.selection.clear();
                }
                Task::none()
            }

            Message::ToggleHidden => {
                self.show_hidden = !self.show_hidden;
                self.rebuild();
                Task::none()
            }

            Message::SidebarToggleExpand(path) => {
                if self.expanded.remove(&path).is_some() {
                    Task::none()
                } else {
                    self.expanded.insert(path.clone(), Vec::new());
                    load_subdirs(path)
                }
            }

            Message::Copy => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let paths = self.selected_paths();
                if !paths.is_empty() {
                    self.clipboard = Some(Clipboard {
                        paths,
                        mode: ClipboardMode::Copy,
                    });
                }
                Task::none()
            }
            Message::Cut => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let paths = self.selected_paths();
                if !paths.is_empty() {
                    self.clipboard = Some(Clipboard {
                        paths,
                        mode: ClipboardMode::Cut,
                    });
                }
                Task::none()
            }
            Message::Paste => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let Some(clip) = self.clipboard.clone() else {
                    return Task::none();
                };
                let dest = self.history.current().to_path_buf();
                match clip.mode {
                    ClipboardMode::Copy => {
                        Task::perform(ops::copy_into_async(clip.paths, dest), Message::OpDone)
                    }
                    ClipboardMode::Cut => {
                        self.clipboard = None;
                        Task::perform(ops::move_into_async(clip.paths, dest), Message::OpDone)
                    }
                }
            }
            Message::DeleteSelected => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                let paths = self.selected_paths();
                if paths.is_empty() {
                    return Task::none();
                }
                Task::perform(ops::delete_to_trash_async(paths), Message::OpDone)
            }
            Message::NewFolder => {
                self.context_menu = None;
                if busy {
                    return Task::none();
                }
                match ops::create_folder(self.history.current()) {
                    Ok(path) => {
                        self.pending_rename = Some(path);
                        self.reload()
                    }
                    Err(e) => {
                        self.notice = Some(e);
                        Task::none()
                    }
                }
            }
            Message::RenameStart(index) => {
                self.context_menu = None;
                self.begin_rename(index)
            }
            Message::RenameSelected => {
                if busy {
                    return Task::none();
                }
                match self.selection.single() {
                    Some(i) => self.begin_rename(i),
                    None => Task::none(),
                }
            }
            Message::RenameChanged(value) => {
                if let Some(r) = self.renaming.as_mut() {
                    r.value = value;
                }
                Task::none()
            }
            Message::RenameSubmit => {
                if let Some(r) = self.renaming.take() {
                    if let Some(entry) = self.entries.get(r.index) {
                        let path = entry.path.clone();
                        match ops::rename(&path, &r.value) {
                            Ok(_) => return self.reload(),
                            Err(e) => self.notice = Some(e),
                        }
                    }
                }
                Task::none()
            }
            Message::ActivateEntry(index) => {
                self.context_menu = None;
                self.activate(index)
            }
            Message::OpDone(result) => {
                let task = self.reload();
                self.notice = result.err();
                task
            }

            Message::CursorMoved(point) => {
                self.cursor = point;
                Task::none()
            }
            Message::EntryRightPressed(index) => {
                if !self.selection.contains(index) {
                    self.selection.select_one(index);
                }
                self.context_menu = Some(Menu {
                    position: self.cursor,
                    target: Some(index),
                });
                Task::none()
            }
            Message::BackgroundRightPressed => {
                self.selection.clear();
                self.context_menu = Some(Menu {
                    position: self.cursor,
                    target: None,
                });
                Task::none()
            }
            Message::ContextClose => {
                self.context_menu = None;
                Task::none()
            }

            Message::ModifiersChanged(m) => {
                self.modifiers = m;
                Task::none()
            }
        }
    }

    pub fn view(&self) -> Element<'_, Message> {
        let current = self.history.current();

        let toolbar = ui::toolbar::view(
            current,
            self.address_edit.as_deref(),
            self.history.can_go_back(),
            self.history.can_go_forward(),
            current.parent().is_some(),
            self.show_hidden,
        );

        let commandbar = ui::commandbar::view(
            !self.selection.is_empty(),
            self.selection.single().is_some(),
            self.clipboard.is_some(),
        );

        let sidebar = ui::sidebar::view(&self.quick_access, &self.drives, &self.expanded, current);

        let renaming = self
            .renaming
            .as_ref()
            .map(|r| (r.index, r.value.as_str()));

        let list = ui::file_list::view(
            &self.entries,
            &self.selection,
            self.sort,
            self.loading,
            self.error.as_deref(),
            renaming,
        );

        let status = ui::status_bar::view(&self.entries, &self.selection, self.notice.as_deref());

        let body = row![
            sidebar,
            rule::vertical(1),
            container(list).width(Length::Fill).height(Length::Fill),
        ]
        .height(Length::Fill);

        let content = column![
            toolbar,
            rule::horizontal(1),
            commandbar,
            rule::horizontal(1),
            body,
            rule::horizontal(1),
            status,
        ];

        match &self.context_menu {
            Some(menu) => {
                let target_is_dir = menu
                    .target
                    .and_then(|i| self.entries.get(i))
                    .map(|e| e.is_dir)
                    .unwrap_or(false);
                let overlay =
                    ui::context::view(menu, self.clipboard.is_some(), target_is_dir);
                stack![content, overlay].into()
            }
            None => content.into(),
        }
    }

    pub fn subscription(&self) -> Subscription<Message> {
        iced::event::listen_with(|event, _status, _window| match event {
            Event::Keyboard(keyboard::Event::ModifiersChanged(m)) => {
                Some(Message::ModifiersChanged(m))
            }
            Event::Keyboard(keyboard::Event::KeyPressed { key, modifiers, .. }) => {
                map_key(key, modifiers)
            }
            Event::Mouse(iced::mouse::Event::CursorMoved { position }) => {
                Some(Message::CursorMoved(position))
            }
            _ => None,
        })
    }

    // --- helpers ---

    fn reload(&mut self) -> Task<Message> {
        self.loading = true;
        self.error = None;
        self.notice = None;
        self.selection.clear();
        self.last_click = None;
        self.address_edit = None;
        self.renaming = None;
        self.context_menu = None;
        load_dir(self.history.current().to_path_buf())
    }

    fn selected_paths(&self) -> Vec<PathBuf> {
        self.selection
            .indices()
            .filter_map(|i| self.entries.get(i))
            .map(|e| e.path.clone())
            .collect()
    }

    fn begin_rename(&mut self, index: usize) -> Task<Message> {
        if let Some(entry) = self.entries.get(index) {
            self.selection.select_one(index);
            self.renaming = Some(Renaming {
                index,
                value: entry.name.clone(),
            });
            return iced::widget::operation::focus(ui::file_list::RENAME_ID);
        }
        Task::none()
    }

    fn rebuild(&mut self) {
        let mut v: Vec<Entry> = self
            .all_entries
            .iter()
            .filter(|e| self.show_hidden || !e.hidden)
            .cloned()
            .collect();
        sort_entries(&mut v, self.sort);
        self.entries = v;
        self.selection.clear();
        self.last_click = None;
    }

    fn activate(&mut self, index: usize) -> Task<Message> {
        if let Some(entry) = self.entries.get(index) {
            if entry.is_dir {
                let path = entry.path.clone();
                self.history.push(path);
                return self.reload();
            }
        }
        Task::none()
    }
}

fn load_dir(path: PathBuf) -> Task<Message> {
    Task::perform(fs::scan_dir_async(path.clone()), move |result| {
        Message::DirLoaded {
            path: path.clone(),
            result,
        }
    })
}

fn load_subdirs(path: PathBuf) -> Task<Message> {
    Task::perform(fs::scan_subdirs_async(path.clone()), move |result| {
        Message::SubdirsLoaded {
            path: path.clone(),
            result,
        }
    })
}

fn map_key(key: keyboard::Key, modifiers: keyboard::Modifiers) -> Option<Message> {
    use keyboard::key::Named;
    use keyboard::Key;
    match key {
        Key::Named(Named::Enter) => Some(Message::KeyActivate),
        Key::Named(Named::Backspace) => Some(Message::GoUp),
        Key::Named(Named::F5) => Some(Message::Refresh),
        Key::Named(Named::F2) => Some(Message::RenameSelected),
        Key::Named(Named::Delete) => Some(Message::DeleteSelected),
        Key::Named(Named::Escape) => Some(Message::EscapePressed),
        Key::Named(Named::ArrowLeft) if modifiers.alt() => Some(Message::GoBack),
        Key::Named(Named::ArrowRight) if modifiers.alt() => Some(Message::GoForward),
        Key::Character(ref c) if modifiers.control() => {
            let c = c.as_str();
            if modifiers.shift() && c.eq_ignore_ascii_case("n") {
                Some(Message::NewFolder)
            } else if c.eq_ignore_ascii_case("a") {
                Some(Message::SelectAll)
            } else if c.eq_ignore_ascii_case("c") {
                Some(Message::Copy)
            } else if c.eq_ignore_ascii_case("x") {
                Some(Message::Cut)
            } else if c.eq_ignore_ascii_case("v") {
                Some(Message::Paste)
            } else {
                None
            }
        }
        _ => None,
    }
}
