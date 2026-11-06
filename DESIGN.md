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
| `gallery_file(title, adapter)` | The same in a temporary file, which a server loads at startup with `AppHtml::load` |

## The Look

An App uses the host's theme, so it matches where it is shown, and these values where the host says nothing. Any new App starts from them.

| What | Value |
|---|---|
| Colors | `--bg`, `--soft`, `--fg`, `--muted`, `--line`, `--accent`, `--danger`, each from the host's `--color-*` variable, with a light and a dark value |
| Type | The host's sans, 14 px body, 16 px semibold for where you are, 12 px muted for facts. A record's fields are 12 px monospace |
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
| `list({at, search, cursor})` | A page: `items`, `next`, `trail` for where it is, `empty` for an empty one, and optionally `pictures`, what is ready of what is on it, each `{key, mediaType, data}`, none of which then costs another request |
| `thumbnail(item, size)` | `{mediaType, data}` from a tool of the server's own |
| `thumbnails(items, size)` | Optional: by one request, an answer for each item, `{mediaType, data}` for what is ready, nothing when there is no picture, or `{pending: true}` for one that `thumbnail` can still draw |
| `open(item)` | The URL `ui/open-link` opens |
| `enter(item)` | For an item with `folder`: where it leads |
| `covers(items)` | Optional, for items with `folder` and no `cover`: by one request, the items whose pictures show on each card. The server decides them; the page never searches |

An item is `{key, name, kind, about, fields, badge, group, folder, disabled, cover, into}`. `cover` is the items whose pictures show a folder, when the page already knows them. `into` is where an item's closer look can lead on to, as `Files`. `ui.kindOf(name, mediaType)` says what a file holds, by
name and then by media type.

`about` is one short fact for its card, such as its size. `fields` is the record the server holds of an item, and the closer look shows it
as it is: each value under its own name, a nested one under a dotted name such as `provenance.actingServer`. A gallery never composes a
record into a sentence, and adds nothing to what the record says.

The next page loads as the end of the list comes near, and joins what is showing, so what is on screen stays as it is however long the list. Pictures that came with a page show at once. The others load as cards come on screen. What comes on screen together is asked for together, at most 24 to a request, so a screen of
pictures that are ready costs one request; each one still to be drawn then takes its own. Requests run six at a time, the newest first,
and pictures are kept for as long as the page is open. A card shows its kind's icon until its picture comes, and goes on showing it when
there is none.

An adapter's `ui.go(at)` moves the gallery to a place it would list, for a server whose page holds a gallery beside something else.

Every name is a stranger's text, so it reaches the page only as text. A picture reaches it only as a `data:image/` URL.

## Limits

The host navigates its own page for `ui/open-link`, so coming back starts a gallery over.
