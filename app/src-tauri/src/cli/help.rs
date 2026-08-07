const AMBER: &str = "\x1b[38;2;245;158;11m";
const TEAL: &str = "\x1b[38;2;20;184;166m";
const DIM: &str = "\x1b[38;2;113;113;122m";
const BOLD: &str = "\x1b[1m";
const RESET: &str = "\x1b[0m";

pub fn print_help() {
    println!(
        r#"{BOLD}{AMBER}Lattice CLI (lat / lattice-cli) v0.2.0{RESET}
{DIM}Terminal search, previews, and desktop hand-off for Lattice{RESET}

{BOLD}USAGE:{RESET}
    lat [FLAGS] [QUERY / PATH]

{BOLD}FLAGS:{RESET}
    {AMBER}<query>{RESET}             Fast filename/path search (default: top 5 matches)
    {AMBER}-t, --text{RESET} <query>    Full-text content search (FTS5 bm25 ranking)
    {AMBER}-s, --semantic{RESET} <q>   Semantic vector search (FastEmbed cosine similarity)
    {AMBER}-p, --preview{RESET} <file>  Terminal file preview with line numbers & syntax colors
    {AMBER}-o, --open{RESET} [index]   Direct open file; opens folder inside Lattice GUI
    {AMBER}-r, --reveal{RESET} [index]  Reveal file/folder inside Lattice GUI window
    {AMBER}-n, --limit{RESET} <count>  Set max search results (default: 5)
    {AMBER}--install{RESET}           Install lat & lattice-cli directly to Windows PATH
    {AMBER}-h, --help{RESET}           Display this help documentation

{BOLD}SPOTLIGHT PREFIX CONVENTIONS:{RESET}
    {TEAL}= <expr>{RESET}          Terminal Math Evaluator  (e.g., lat "= 256 * 1024")
    {TEAL}@<kind> <query>{RESET}   Kind Filter Search       (e.g., lat "@image png")
    {TEAL}> <app>{RESET}           App Launcher             (e.g., lat "> vscode")
    {TEAL}? <query>{RESET}         Web Search               (e.g., lat "? rust lang")

{BOLD}ACCEPTED KINDS FOR @<kind>:{RESET}
    {TEAL}image{RESET} / {TEAL}img{RESET}      Photos, screenshots, icons (.png, .jpg, .svg, .webp)
    {TEAL}code{RESET}            Source code & data (.rs, .js, .ts, .py, .go, .json)
    {TEAL}doc{RESET} / {TEAL}document{RESET}  Documents & text (.pdf, .md, .txt, .docx)
    {TEAL}folder{RESET} / {TEAL}dir{RESET}    Directories & folders
    {TEAL}audio{RESET}           Music & audio (.mp3, .wav, .flac, .m4a)
    {TEAL}video{RESET}           Video files (.mp4, .mkv, .mov, .webm)
    {TEAL}archive{RESET}         Compressed archives (.zip, .tar, .gz, .7z)

{BOLD}EXAMPLES:{RESET}
    lat "main.rs"
    lat "@image screenshot"
    lat "@code scan_dir"
    lat -t "scan_dir_async"
    lat -p README.md
    lat "Screenshots" -o
    lat "= (100 + 450) / 2"
"#
    );
}
