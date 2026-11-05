# Agent Instructions

These rules apply to veoveo-hub-ui.

- The design is in [DESIGN.md](DESIGN.md). Change it in the same change as the code.
- This crate names no server. Whatever is specific to one server goes in that server's adapter.
- It depends on nothing, in Rust or in the browser: no npm, bundler or framework, and a page loads nothing from elsewhere.
- Every name a server lists is a stranger's text: it reaches the page through `textContent` and never through `innerHTML`.
- Keep test logic in Rust and tool behavior in each tool's own configuration.
- Pin exact versions and image digests.
- Run `docker build --target check .` on macOS and on Linux before pushing. A browser checks what the gate cannot: look
  at the change in a real App.
- Commit small, coherent changes. Commits carry no AI or tool attribution.
