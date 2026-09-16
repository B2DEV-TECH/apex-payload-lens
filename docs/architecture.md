# Architecture

PayloadLens is deliberately small and split into two independent layers: a
thin Oracle APEX region plugin (PL/SQL) that resolves the region's source
and emits markup, and a self-contained, dependency-free JavaScript/CSS
layer that does all the actual parsing, masking, and rendering in the
browser. Neither layer trusts the other with more than it needs.

```
┌─────────────────────────────┐        ┌───────────────────────────────┐
│  APEX region (PL/SQL)       │  JSON  │  Browser (payload-lens.js/css)  │
│  resolves region source,    │──────▶ │  parse → mask → render tree/    │
│  emits mount div + config   │        │  code view, search, copy        │
└─────────────────────────────┘        └───────────────────────────────┘
```

## Why the split

- **The server never trusts the client with credentials or query logic.**
  The PL/SQL render function resolves a *Static Value* (substitution
  strings included) or a *PL/SQL Function Body* exactly once, server-side,
  with the page's session and bind variables. The browser only ever
  receives the already-resolved JSON text — it has no way to ask the server
  for more data on its own, because it never has to. The one client-side
  source, *Item*, reads a page item that is already part of the page.
- **The client never trusts the payload with more than display.** Once the
  JSON text reaches the browser, everything — parsing, masking, tree
  building, tokenizing for the code view, searching — is pure, dependency-
  free JavaScript operating on in-memory values. See
  [security.md](security.md) for exactly how that rendering avoids ever
  treating payload content as executable markup.

## The PL/SQL layer (region plugin)

PayloadLens is implemented as an Oracle APEX **region** plugin on the
classic plugin API (`p_api_version => 1`: `apex_plugin.t_region`,
`t_plugin`, and `t_region_render_result`). Its render function's job is
narrow and mechanical:

1. Resolve the configured source (see [configuration.md](configuration.md))
   into a JSON string: a *Static Value* goes through
   `apex_plugin_util.replace_substitutions`; a *PL/SQL Function Body* is
   wrapped in an anonymous block and executed with `execute immediate`,
   and if it raises, the error message becomes the payload so the page
   still renders (the region shows its invalid-JSON state); an *Item* is
   not read on the server at all — only its name is passed on.
2. Emit an empty mount element for the client library to take over —
   `<div id="<dom_id>_pl" class="payload-lens"></div>` — where `<dom_id>`
   is the region's DOM id (the Static ID when one is set; APEX generates a
   stable one otherwise, so it is unique per page).
3. Register the plugin's CSS and JS via the standard `apex_css.add_file` /
   `apex_javascript.add_library` APIs with `p_plugin.file_prefix` as the
   directory, so the embedded files resolve wherever APEX serves plugin
   files from.
4. Serialize the resolved attributes (display mode, masking options, size
   limit, etc. — see [configuration.md](configuration.md)) with `apex_json`
   into a `<script type="application/json">` element next to the mount
   point (every `</` inside it is written as `<\/`, so a payload cannot
   close the block early), and register a one-line
   `apex_javascript.add_onload_code` call that `JSON.parse`s that element
   and hands the result to `payloadLens.init()` once the DOM is ready.

Everything past that point — actually reading the JSON, deciding what to
show, masking it, letting the user search or copy it — is the client
library's responsibility, not the PL/SQL layer's. This keeps the region
plugin itself small, auditable, and free of any business logic that would
need its own test suite beyond "does it emit the right markup and call the
JS with the right config."

### Multi-instance isolation

Because a single APEX page can contain more than one PayloadLens region
(for example, a request payload and a response payload side by side), the
client library keeps every instance's state — its DOM references, its
current view mode, its search index, its masking configuration — in an
internal registry keyed by that instance's static id. Nothing about
rendering, masking, or searching one instance ever reads or writes another
instance's state, so two regions never interfere with each other even
though they share the same loaded `payload-lens.js` module.

## The JavaScript layer

`src/js/payload-lens.js` is a single UMD module with no runtime
dependencies, registering itself as `window.payloadLens`. Its public API
(`init`, `refresh`, `setPayload`, `expandAll`, `collapseAll`, `destroy`) is
documented in full in [javascript-api.md](javascript-api.md). Internally, it
is organized as a small pipeline:

### Parsing model

`parsePayload(raw)` is the single entry point for turning "whatever the
server sent" into a well-defined, tagged result — it never throws:

| Input | Result |
| --- | --- |
| `undefined` | `{ status: 'empty', emptyKind: 'undefined' }` |
| `null`, or the JSON literal `null` | `{ status: 'empty', emptyKind: 'null' }` |
| `""` or a whitespace-only string | `{ status: 'empty', emptyKind: 'empty-string' }` |
| `{}` | `{ status: 'empty', emptyKind: 'empty-object' }` |
| `[]` | `{ status: 'empty', emptyKind: 'empty-array' }` |
| Valid JSON (or an already-parsed value) | `{ status: 'ok', value }` |
| Invalid JSON text | `{ status: 'error', error: { message, detail } }` |

Every one of these six shapes has a corresponding, deliberate render state
(an empty-state message, an error box, or the actual viewer) — there is no
"should never happen" branch in the render path, because every input
`parsePayload` can classify already has a defined UI for it.

Note that `parsePayload` itself has **no awareness of any size limit**. The
"Max Display Bytes" check happens one step later, in the render function,
which measures the UTF-8 byte length of the parsed value re-serialized as
JSON and substitutes a "too large" state for the normal tree/code render if
it exceeds the configured (and hard-capped) limit. This separation is
intentional: parsing/classification and size-based render gating are
different concerns, and keeping them separate is what lets
`tests/parsing.test.js` test each independently.

### Masking

Covered in full in [masking.md](masking.md). Runs once, immediately after
parsing succeeds, on the parsed value, before that value reaches tree
building, tokenizing, or search.

### Tree view

`buildTreeModel(value)` turns the (masked) value into a plain-data tree —
each node is `{ path, key, depth, type, children }` for objects/arrays or
`{ path, key, depth, type, value }` for leaves — with no HTML or DOM
involved at all. The DOM tree is built from that model using only
`createElement`/`createTextNode` (see [security.md](security.md)).

### Code view

`tokenize(value)` walks the (masked) value and emits a flat array of
`{ type, text }` tokens (punctuation, whitespace, keys, strings, numbers,
booleans, `null`) representing pretty-printed JSON — again, plain data, not
an HTML string. The code view's renderer turns that token stream into
syntax-highlighted `<span>` elements purely via `createElement` and
`className`, never by building or parsing an HTML string.

### Search

Search operates over the same masked value/rendered structure the user is
already looking at, highlighting matches and letting the user step between
them — it never has access to, and cannot accidentally surface, anything
that was masked before it ran.

### Metadata

`calculateMetadata(value)` computes `{ sizeBytes, propertyCount,
arrayElementCount, maxDepth }` structurally, by walking the *original,
unmasked* value and counting shape only (see [masking.md](masking.md) for
why that's safe). No field name or value is ever included in these figures.

## Repository layout

```
apex-payload-lens/
├── plugin/           payload_lens_pkg.sql (PL/SQL render package) + the APEX plugin export (.sql)
├── src/js/           payload-lens.js — the client library, hand-written, unminified
├── src/css/          payload-lens.css — scoped styles, light/dark aware
├── dist/             built, minified assets embedded into the plugin
├── tests/            vitest + happy-dom test suite
├── demo/             demo application export (APEX 26.1) + synthetic example.com/example.test JSON fixtures
├── docs/             this documentation set
└── scripts/          build.mjs (esbuild bundling) and sync-plugin-files.mjs (embeds dist/ into the APEX exports)
```
