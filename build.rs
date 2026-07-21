fn main() {
    // Embed the Windows executable icon (taskbar, Explorer, title bar) from the
    // brand asset. Best-effort: if the resource compiler isn't available this
    // must not break the build, so we warn rather than panic.
    #[cfg(windows)]
    {
        println!("cargo:rerun-if-changed=branding/favicon.ico");
        let mut res = winresource::WindowsResource::new();
        res.set_icon("branding/favicon.ico");
        if let Err(e) = res.compile() {
            println!("cargo:warning=could not embed exe icon: {e}");
        }
    }
}
