# Hub UI Design

UI for Apps on the Hub: what looks and behaves the same in every App, so that no server keeps its own copy.

An App's view is one document in a sandboxed frame, whose policy loads nothing from elsewhere and which reads only its own
server. So a piece of UI cannot be a shared URL. It is text a server puts into its document when it starts, from this crate, pinned
by Git revision like any dependency.

This crate apart from the SDK, because servers that call each other must share one SDK revision. A fix here reaches each server when
that server moves its pin, and moves nothing else.

## Contents

| Piece | What it is |
|---|---|
| `APP_SCRIPT` | `veoveoApp`: the MCP Apps bridge and the host's theme, for any App |
| `gallery(title, adapter)` | The document of a gallery App |

## The Look

An App uses the host's theme, so it matches where it is shown, and these values where the host says nothing. Any new App starts from them.

| What | Value |
|---|---|
| Colors | `--bg`, `--soft`, `--fg`, `--muted`, `--line`, `--accent`, `--danger`, each from the host's `--color-*` variable, with a light and a dark value |
| Type | The host's sans, 14 px body, 16 px semibold for where you are, 12 px muted for facts |
| Spacing | 16 px around the page, 14 px between things, 18 px between rows of cards |
| Corners | 10 px on cards, 8 px on controls, 14 px on a dialog |
| Controls | A 1 px `--line` border. Hover and focus show `--accent`; a chosen one is filled |
| Motion | Under 0.2 s, and none when a person asks for reduced motion |

## The Gallery

A gallery lists what a server has, with a picture of each: cards or rows, a name filter, filters by kind, folders and groups, more
pages, and a closer look with a larger picture, the previous and next item, and Open. It knows nothing of what it shows. A server
supplies an adapter, a script that calls `veoveoGallery` with:

| Field | What it says |
|---|---|
| `title` | The App's name |
| `aspect` | The cards' shape, `4 / 3` by default |
| `placeholder`, `remoteSearch`, `refresh` | The filter's words, whether the server filters by name, and whether to offer Refresh |
| `list({at, search, cursor})` | A page: `items`, `next`, `trail` for where it is, `empty` for an empty one |
| `thumbnail(item, size)` | `{mediaType, data}` from a tool of the server's own |
| `open(item)` | The URL `ui/open-link` opens |
| `enter(item)`, `cover(item)` | For an item with `folder`: where it leads, and whose pictures show on its card |

An item is `{key, name, kind, about, detail, badge, group, folder, disabled}`. `ui.kindOf(name, mediaType)` says what a file holds, by
name and then by media type.

Pictures load as cards come on screen, six at a time and the newest first, and are kept for as long as the page is open. A card shows
its kind's icon until its picture comes, and goes on showing it when there is none.

Every name is a stranger's text, so it reaches the page only as text. A picture reaches it only as a `data:image/` URL.

## Limits

The host navigates its own page for `ui/open-link`, so coming back starts a gallery over.
