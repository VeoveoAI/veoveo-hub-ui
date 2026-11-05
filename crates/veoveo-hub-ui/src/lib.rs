//! UI for Apps on the Hub: what looks and behaves the same in every App, so that no server keeps its
//! own copy. An App's view is one document in a sandboxed frame that loads nothing from elsewhere, so
//! each piece is text a server puts into that document when it starts. It depends on nothing and
//! names no server: a server says what is specific to it in an adapter of its own.

/// The MCP Apps bridge and the host's theme, for any App.
pub const APP_SCRIPT: &str = include_str!("../assets/app.js");

const GALLERY_STYLE: &str = include_str!("../assets/gallery.css");
const GALLERY_MARKUP: &str = include_str!("../assets/gallery.html");
const GALLERY_SCRIPT: &str = include_str!("../assets/gallery.js");

/// The document of a gallery App called `title`, whose `adapter` is a script that calls
/// `veoveoGallery` with what is specific to its server.
///
/// # Panics
///
/// When `adapter` holds `</script`, which would end its element. An adapter is a server's own
/// constant, so this fails at the server's first test.
pub fn gallery(title: &str, adapter: &str) -> String {
    assert!(
        !adapter.to_ascii_lowercase().contains("</script"),
        "an adapter may not end its own script element"
    );
    let title = escaped(title);
    format!(
        "<!doctype html>\n<html lang=\"en\" data-theme=\"light\">\n<head>\n<meta charset=\"utf-8\">\n\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
         <meta name=\"color-scheme\" content=\"light dark\">\n<title>{title}</title>\n\
         <style>\n{GALLERY_STYLE}</style>\n</head>\n<body>\n{GALLERY_MARKUP}<script>\n{APP_SCRIPT}\n{GALLERY_SCRIPT}\n{adapter}\n</script>\n</body>\n</html>\n"
    )
}

/// Writes a gallery's document to a file in the system's temporary folder and answers its path, for
/// a server to load at startup as it would any App's document.
pub fn gallery_file(title: &str, adapter: &str) -> std::io::Result<std::path::PathBuf> {
    let name: String = title
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .collect::<String>()
        .to_ascii_lowercase();
    let path = std::env::temp_dir().join(format!("veoveo-app-{}-{name}.html", std::process::id()));
    std::fs::write(&path, gallery(title, adapter))?;
    Ok(path)
}

fn escaped(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    const ADAPTER: &str = "veoveoGallery((ui) => ({ title: \"T\" }));";

    #[test]
    fn a_file_holds_the_document() {
        let path = gallery_file("Some Title!", ADAPTER).unwrap();
        assert!(path.to_string_lossy().contains("sometitle.html"));
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            gallery("Some Title!", ADAPTER)
        );
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn a_title_is_text() {
        let page = gallery("A <b> & \"c\"", ADAPTER);
        assert!(page.contains("<title>A &lt;b&gt; &amp; &quot;c&quot;</title>"));
    }

    #[test]
    fn the_adapter_comes_after_what_it_calls() {
        let page = gallery("T", ADAPTER);
        let bridge = page.find("const veoveoApp =").unwrap();
        let library = page.find("const veoveoGallery =").unwrap();
        let adapter = page.find(ADAPTER).unwrap();
        assert!(bridge < library && library < adapter);
    }

    #[test]
    #[should_panic(expected = "may not end its own script element")]
    fn an_adapter_cannot_end_its_element() {
        gallery("T", "const x = \"</SCRIPT>\";");
    }

    #[test]
    fn the_page_loads_nothing_from_elsewhere() {
        let page = gallery("T", ADAPTER);
        for needle in [
            "src=\"", "href=\"", "http://", "https://", "@import", "url(",
        ] {
            assert!(!page.contains(needle), "{needle}");
        }
    }

    #[test]
    fn every_id_the_script_asks_for_is_in_the_markup() {
        let mut rest = GALLERY_SCRIPT;
        while let Some(start) = rest.find("$(\"") {
            rest = &rest[start + 3..];
            let id = &rest[..rest.find('"').unwrap()];
            assert!(
                GALLERY_MARKUP.contains(&format!("id=\"{id}\"")),
                "the script asks for #{id}"
            );
        }
    }

    #[test]
    fn the_scripts_parse() {
        let folder = tempfile_dir();
        let path = folder.join("page.js");
        std::fs::write(
            &path,
            format!("{APP_SCRIPT}\n{GALLERY_SCRIPT}\n{ADAPTER}\n"),
        )
        .unwrap();
        let checked = Command::new("node")
            .arg("--check")
            .arg(&path)
            .output()
            .expect("node, as the dev image provides it");
        std::fs::remove_dir_all(&folder).unwrap();
        assert!(
            checked.status.success(),
            "{}",
            String::from_utf8_lossy(&checked.stderr)
        );
    }

    fn tempfile_dir() -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!("veoveo-hub-ui-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }
}
