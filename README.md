# veoveo-hub-ui

UI for Apps on the Veoveo Hub: what looks and behaves the same in every App, so that no server keeps its own copy. It starts with a
gallery, used by the Lore, Artifact and USD Apps.

```rust
let page = AppHtml::load(&veoveo_hub_ui::gallery_file("Artifacts", include_str!("../assets/library.js"))?)?;
```

It depends on nothing and needs no build step. See [DESIGN.md](DESIGN.md).

```sh
docker build --target check .
```

## License

Apache-2.0.
