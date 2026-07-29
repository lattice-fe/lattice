// The indexer is built up over several phases; some items land before the
// code that consumes them. Silence dead-code noise until it's all wired.
#![allow(dead_code)]

pub mod chunk;
pub mod db;
pub mod embed;
pub mod extract;
pub mod search;
pub mod walk;
pub mod worker;

pub use db::CollectionInfo;
pub use search::{SearchHit, SearchMode};
pub use worker::{spawn, Command, Event};
