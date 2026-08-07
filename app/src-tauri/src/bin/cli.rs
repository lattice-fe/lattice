use std::env;

#[path = "../cli/mod.rs"]
mod cli;

fn main() {
    let args: Vec<String> = env::args().collect();
    std::process::exit(cli::run(args));
}
