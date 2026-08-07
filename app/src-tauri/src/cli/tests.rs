#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use lattice_lib::core::index::search::SearchHit;
    use super::super::{eval_math, kind_matches, urlencoding};

    fn hit(path: &str, is_dir: bool) -> SearchHit {
        SearchHit { file_path: PathBuf::from(path), is_dir, snippet: String::new(), score: 1.0, char_start: 0 }
    }

    #[test]
    fn test_math_evaluator() {
        assert_eq!(eval_math("256 * 1024"), Some("262144".to_string()));
        assert_eq!(eval_math("(100 + 450) / 2"), Some("275".to_string()));
        assert_eq!(eval_math("2+2"), Some("4".to_string()));
        assert_eq!(eval_math("7 / 2"), Some("3.5".to_string()));
        assert_eq!(eval_math("-3 + 5"), Some("2".to_string()));
        assert_eq!(eval_math("10 % 3"), Some("1".to_string()));
        // malformed / unsafe → None
        assert_eq!(eval_math("system('dir')"), None);
        assert_eq!(eval_math("abc + 123"), None);
        assert_eq!(eval_math("2 +"), None);
        assert_eq!(eval_math("(1 + 2"), None);
        assert_eq!(eval_math("5 / 0"), None);
    }

    #[test]
    fn test_url_encoding() {
        assert_eq!(urlencoding::encode("rust lang"), "rust+lang");
        assert_eq!(urlencoding::encode("tauri react 19"), "tauri+react+19");
    }

    #[test]
    fn test_kind_matches() {
        assert!(kind_matches(&hit("photo.png", false), Some("image")));
        assert!(kind_matches(&hit("diagram.svg", false), Some("image")));
        assert!(!kind_matches(&hit("main.rs", false), Some("image")));

        assert!(kind_matches(&hit("main.rs", false), Some("code")));
        assert!(kind_matches(&hit("app.tsx", false), Some("code")));
        assert!(!kind_matches(&hit("photo.png", false), Some("code")));

        assert!(kind_matches(&hit("src", true), Some("folder")));
        assert!(!kind_matches(&hit("main.rs", false), Some("folder")));

        // no filter matches everything
        assert!(kind_matches(&hit("anything.xyz", false), None));
    }
}
