# JavaScript API

PayloadLens exposes a single browser global, `window.payloadLens`, as a small
UMD module. The Oracle APEX region plugin calls this API for you through the
generated page JavaScript — most APEX developers never need to call it
directly. It is documented here for:

- developers building a custom Dynamic Action that talks to a PayloadLens
  region (for example, pushing a new payload after an AJAX call), and
- anyone embedding PayloadLens outside of APEX, in a plain HTML page.

Everything in this document is the *stable* API. A second surface,
`payloadLens._internal`, exists purely so the project's own test suite
(`tests/*.test.js`) can unit test the parsing/masking/metadata logic in
isolation. `_internal` is not covered by semantic versioning, is not meant
for application code, and may change shape between minor versions without
notice.

## Loading the library

The plugin loads `payload-lens.js` (or the minified `dist/payload-lens.min.js`)
as a plain `<script>` tag via `apex_javascript.add_library`. It registers
itself as `window.payloadLens` and has no runtime dependencies — not even
jQuery or the `apex` namespace (that is only used opportunistically, see
[`refresh`](#refreshstaticid) below).

## Mounting model

Every PayloadLens instance is mounted into a container element whose `id` is
`<staticId>_pl` — for example, a region with static id `INVOICE_PAYLOAD`
must already contain an empty `<div id="INVOICE_PAYLOAD_pl"></div>` in the
DOM before `init()` runs. The region's PL/SQL render function is responsible
for emitting that container; you only need to know the convention if you are
embedding PayloadLens by hand.

Instances are tracked in an internal registry keyed by `staticId`, so
multiple PayloadLens regions can coexist on the same APEX page without
colliding, each independently searchable, maskable, and refreshable.

## init(config)

Creates (or re-creates) a PayloadLens instance inside `#<config.staticId>_pl`
and performs the first render.

```js
const instance = payloadLens.init({
  staticId: 'INVOICE_PAYLOAD',
  sourceType: 'STATIC',
  staticJson: '{"invoiceNumber":"INV-2026-004821"}'
});
```

**Parameters** — all fields live on a single `config` object:

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `staticId` | string | *(required)* | Identifies the mount point (`#<staticId>_pl`) and the instance in the internal registry. Throws if omitted. |
| `sourceType` | `STATIC` or `ITEM` | `STATIC` | Where the payload comes from on init/refresh. See [Source resolution](#source-resolution). |
| `itemName` | string | `null` | APEX page/application item name to read from when `sourceType` is `ITEM`. |
| `staticJson` | string | `undefined` | The payload to render when `sourceType` is `STATIC` (the common case: the PL/SQL render function already resolved the region source and serialized it to JSON). |
| `displayMode` | `tree` or `code` | `tree` | Initial view. Any value other than the literal string `code` falls back to `tree`. |
| `initialExpandDepth` | integer or `ALL` | `1` | How many tree levels start expanded. `ALL` (or `-1`) expands everything. Non-numeric or negative values fall back to `1`. |
| `enableSearch` | boolean | `true` | Shows/hides the search bar. |
| `enableCopy` | boolean | `true` | Shows/hides the "Copy" toolbar action. |
| `enableMetadata` | boolean | `true` | Shows/hides the metadata bar (size, property count, array element count, max depth). |
| `enableMasking` | boolean | `true` | Whether sensitive values are masked at all. Passed straight through as `maskingOptions.enabled` — see [masking.md](masking.md). |
| `sensitiveKeys` | array of strings | built-in default list | Overrides the built-in sensitive key list. See [masking.md](masking.md). |
| `caseSensitiveMasking` | boolean | `false` | If `true`, key matching against `sensitiveKeys` is exact-case only. |
| `maskChar` | string | `*` | Character used to build the mask. Only the first character of the string you pass is used. |
| `maxDisplayBytes` | integer | `1048576` (1 MiB) | Payloads larger than this (measured as UTF-8 bytes of the re-serialized value) render a "too large" state instead of the tree/code view. Always clamped to a hard ceiling of 5 MiB regardless of what you pass. |

**Returns:** the internal instance object, or `null` if no element with id
`<staticId>_pl` exists in the document yet. Throws an `Error` only when
`config.staticId` itself is missing — a missing mount point is treated as a
recoverable "not rendered yet" condition, not a hard error, since APEX can
call region JavaScript before the DOM is fully settled in some page-load
orderings.

### Source resolution

On `init()` and on every `refresh()`, PayloadLens resolves what to render as
follows:

- `sourceType: 'ITEM'` with a non-empty `itemName` — reads the current value
  of that page/application item via `apex.item(itemName).getValue()` when the
  `apex` global is available, falling back to reading the `.value` property
  off a same-id DOM element otherwise (so the plugin degrades gracefully
  outside a full APEX runtime, e.g. in the test suite).
- Anything else (including the default `sourceType: 'STATIC'`) — uses
  `config.staticJson` verbatim. This is the path the APEX region plugin
  uses for the *Static Value* and *PL/SQL Function Body* source types: the
  PL/SQL render function resolves them on the server and emits the
  already-resolved JSON as `staticJson`, so the client never needs server
  credentials or an extra round trip to read it. Only the *Item* source
  type arrives as `sourceType: 'ITEM'`.

## refresh(staticId)

Re-resolves the configured source (page item or static JSON, per
[Source resolution](#source-resolution)) and re-renders the named instance
in place, keeping its current view mode and masking settings, and clearing
any active search.

```js
payloadLens.refresh('INVOICE_PAYLOAD');
```

Returns `true` if the instance exists and was refreshed, `false` if no
instance is registered under that `staticId` (for example, `init()` was
never called, or the region was destroyed).

Typical use: wire this into an APEX Dynamic Action's "True" action (Execute
JavaScript Code) after an AJAX call that updates the underlying page item, so
the viewer reflects a newly received payload without a full page reload.

## setPayload(staticId, value)

Explicitly renders a new payload, bypassing whatever `sourceType`,
`itemName`, or `staticJson` the instance was configured with.

```js
payloadLens.setPayload('INVOICE_PAYLOAD', myJsonStringOrObject);
```

`value` may be a JSON string or an already-parsed JavaScript value (object,
array, or scalar) — it is passed straight into the same parser `init()` uses,
so the same empty/error/ok classification rules apply (see
[architecture.md](architecture.md#parsing-model)). Returns `true` or `false`
the same way `refresh` does.

## expandAll(staticId) / collapseAll(staticId)

Expand or collapse every node in the tree view for the named instance, then
re-render if the tree view is currently active. Both are no-ops (returning
`false`) if the instance doesn't exist or hasn't rendered a tree yet.

`collapseAll` deliberately keeps the root node expanded — collapsing it too
would leave the viewport showing nothing but a single closed root row, which
is rarely what a developer wants when they click "Collapse all".

## destroy(staticId)

Tears down an instance: clears its DOM container, removes the
`payload-lens` class from the mount element, and drops it from the internal
registry. Returns `false` if the instance was already gone.

```js
payloadLens.destroy('INVOICE_PAYLOAD');
```

Use this if a region is being removed from the page dynamically (for
example, inside a modal that gets destroyed on close) and you want to avoid
leaking the instance in PayloadLens's internal registry.

## Error handling philosophy

Every function above that takes a `staticId` fails soft: it returns `false`
for an unknown or already-destroyed instance rather than throwing. Only
`init()` throws, and only for the single programmer-error case of calling it
without a `staticId` at all — every other "nothing to render yet" condition
(missing mount point, empty payload, invalid JSON, oversized payload) is
handled as a normal render state inside the viewer itself, never as a thrown
JavaScript exception that could break the surrounding APEX page.
