# Configuration

Every PayloadLens setting is a **region attribute** in Page Designer
(select the region, then *Attributes* in the property editor). The PL/SQL
render function (`payload_lens_pkg.render`) reads them, resolves the
payload source on the server, and emits one JSON config object that the
JavaScript engine consumes through `window.payloadLens.init(config)` — see
[javascript-api.md](javascript-api.md) for that object. The tables below
list each attribute exactly as it is labelled in Page Designer, the config
key it maps to, and its default.

All attributes are always shown; the three *Source …* attributes are only
used when the matching **Source Type** is selected.

## Payload source

| Attribute | Config key | Default | Purpose |
| --- | --- | --- | --- |
| Source Type | `sourceType` | Static Value | Where the JSON comes from: **Static Value**, **Item**, or **PL/SQL Function Body**. |
| Source Static | `staticJson` | *(empty)* | Used with *Static Value*. The JSON text itself. Substitution strings (`&P1_ITEM.`, `&APP_USER.`) are replaced on the server (`apex_plugin_util.replace_substitutions`) before the text is sent to the browser. |
| Source Item | `itemName` | *(none)* | Used with *Item*. The page or application item whose value holds the JSON. It is read **in the browser** (`apex.item(name).getValue()`) on init and on every `refresh()`, so the region follows the item without a page submit. |
| Source PL/SQL Function Body | `staticJson` (after server-side evaluation) | *(empty)* | Used with *PL/SQL Function Body*. A function body that returns the JSON as `clob` or `varchar2` — for example `return (select payload_clob from integration_log where log_id = :P1_LOG_ID);`. It runs on the server with the page's bind variables. If it raises, the error text is delivered as the payload and surfaces in the region's *invalid JSON* state, so the rest of the page still renders. |

What reaches the browser: *Static Value* and *PL/SQL Function Body* are
resolved in PL/SQL and shipped as `sourceType: "STATIC"` plus `staticJson`;
*Item* is shipped as `sourceType: "ITEM"` plus `itemName` and resolved
client-side. Whatever the source, the JavaScript layer parses, masks, and
renders the text the same way — the source never changes the rendering
model described in [security.md](security.md).

## Display

| Attribute | Config key | Default | Notes |
| --- | --- | --- | --- |
| Display Mode | `displayMode` | Tree View | The view shown first: **Tree View** or **Code View**. The toolbar lets the user switch at any time. |
| Initial Expand Depth | `initialExpandDepth` | `2` | How many nesting levels start open in the tree: `1` opens only the root object/array, `2` also opens its direct children, and so on; `0` starts with the root collapsed. `ALL` (upper case) expands everything. Anything that is not a non-negative integer or `ALL` falls back to `1`. |
| Enable Search | `enableSearch` | Yes | Shows the search box with match count and next/previous navigation. |
| Enable Copy | `enableCopy` | Yes | Shows the Copy button. It copies the **masked** text of the active view — the raw payload is never put on the clipboard. |
| Enable Metadata | `enableMetadata` | Yes | Shows the metadata bar: size, property count, array element count, and max nesting depth. |
| Max Display Bytes | `maxDisplayBytes` | `1048576` (1 MiB) | Payloads whose re-serialized UTF-8 size exceeds this render a "too large" notice instead of the tree or code view. A hard ceiling of 5 MiB (`5242880`) applies whatever value you enter; an empty or non-positive value means the default. |

Search and copy work on the masked payload, so enabling them on a page end
users can reach does not expose anything masking hides. The size limit is a
usability safeguard, not a security boundary — see
[security.md](security.md#client-side-size-limit-is-a-safety-net-not-a-security-boundary).

## Masking

| Attribute | Config key | Default | Notes |
| --- | --- | --- | --- |
| Enable Masking | `enableMasking` | Yes | Turns key-based masking on or off. Switch it off only on developer-only pages — see [masking.md](masking.md). |
| Sensitive Keys | `sensitiveKeys` | *(empty = built-in list)* | Comma-separated key names. Leave it empty to use the built-in list (`password`, `token`, `apikey`, `email`, `taxid`, … — the full list is in [masking.md](masking.md)). A non-empty value **replaces** that list rather than extending it, so repeat the built-in names you still want. Whitespace around names is ignored and empty entries are skipped. |
| Case Sensitive Masking | `caseSensitiveMasking` | No | By default `CardNumber`, `cardnumber`, and `CARDNUMBER` all match `cardNumber`. Set it to Yes for exact-case matching only. |
| Mask Character | `maskChar` | `*` | The character masked values are drawn with. Only the first character of the value is used; empty means `*`. |

What a masked value looks like (scalars, nested objects under a sensitive
key, arrays) is described in [masking.md](masking.md).

## Recommended settings

- **Integration log or support page** (end users can reach it): keep
  *Enable Masking* on, put your integration's own secret field names in
  *Sensitive Keys* together with the built-in names you still need (the
  demo application uses `cardNumber, token, apiKey, webhookSignature,
  authCode`), and keep *Display Mode* at Tree View with *Initial Expand
  Depth* at `2` so the top-level structure is readable at a glance. Page 2
  of the demo application (*Integration Log*) is this setup end to end: a
  classic report whose rows load their payload into an *Item*-sourced
  region through a Dynamic Action and `payloadLens.refresh()`, with no
  page submit.
- **Developer-only debug page**: Code View, *Initial Expand Depth* `ALL`,
  and a larger *Max Display Bytes* (up to the 5 MiB ceiling). Turning
  masking off is only appropriate when the page itself is restricted to
  developers.
- **Request and response side by side**: two regions with different Static
  IDs. Each has its own attributes and its own JavaScript instance — see
  [javascript-api.md](javascript-api.md). Page 3 of the demo application
  (*Request vs Response*) does exactly this with the
  `demo/invoice-request.json` / `demo/invoice-response.json` pair.
