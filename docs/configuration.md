# Configuration

PayloadLens is configured through the standard Oracle APEX Page Designer
attribute panel for the region, the same way you would configure any other
region plugin. Every attribute maps directly onto one field of the
JavaScript configuration object documented in
[javascript-api.md](javascript-api.md) — the PL/SQL render function reads
each attribute and serializes it into the small JSON config object passed to
`payloadLens.init()`.

This document describes each attribute from the Page Designer's point of
view. If you are integrating with PayloadLens from custom JavaScript instead
(for example, a Dynamic Action calling `refresh()` or `setPayload()`), see
[javascript-api.md](javascript-api.md) for the underlying config keys, and
[masking.md](masking.md) for the masking-specific settings in depth.

## Source attributes

| Attribute | Maps to | Notes |
| --- | --- | --- |
| Payload Source Type | `sourceType` | `Static / SQL / PL-SQL Expression` or `Page/Application Item`. Controls how the region resolves *what* to render. |
| Item Name | `itemName` | Only used when Payload Source Type is `Page/Application Item`. Name of the page or application item holding the JSON text. |
| Source | `staticJson` (after server-side resolution) | The region's normal **Source** attribute (SQL, PL/SQL function body, or a static value) — resolved on the server exactly like any other APEX region, then serialized to JSON and handed to the client. Used when Payload Source Type is `Static / SQL / PL-SQL Expression`. |

The key design point: whichever source type you choose, the *value* the
browser receives has already been fully resolved server-side. PayloadLens's
JavaScript never queries the database, never calls an APEX AJAX callback on
its own, and never needs the page item's name at render time unless you
explicitly chose the Page/Application Item source type — this keeps the
plugin's client-side attack surface minimal (see [security.md](security.md)).

## Display attributes

| Attribute | Maps to | Default |
| --- | --- | --- |
| Initial View | `displayMode` | Tree |
| Initial Expand Depth | `initialExpandDepth` | `1` |
| Show Search Bar | `enableSearch` | Yes |
| Show Copy Button | `enableCopy` | Yes |
| Show Metadata Bar | `enableMetadata` | Yes |
| Maximum Display Size (bytes) | `maxDisplayBytes` | `1048576` (1 MiB) |

**Initial Expand Depth** accepts a non-negative integer, or the special
value `All` to start with every node expanded. Deeply nested payloads with a
large `All` expansion can be slow to render and hard to scan — the default
of `1` (root's immediate children visible, everything below that collapsed)
is deliberately conservative.

**Maximum Display Size** protects the browser tab from rendering a runaway
payload: anything over this size (measured as the UTF-8 byte length of the
payload re-serialized as JSON) shows a "payload too large" message instead
of the tree or code view. Regardless of what you configure here, PayloadLens
enforces a hard ceiling of 5 MiB that cannot be raised from Page Designer —
if you are routinely hitting that ceiling, the payload likely belongs in a
file/CLOB viewer rather than an inline JSON inspector.

## Masking attributes

| Attribute | Maps to | Default |
| --- | --- | --- |
| Enable Masking | `enableMasking` | Yes |
| Sensitive Keys (comma-separated) | `sensitiveKeys` | built-in default list (see [masking.md](masking.md)) |
| Case-Sensitive Key Matching | `caseSensitiveMasking` | No |
| Mask Character | `maskChar` | `*` |

Leave **Sensitive Keys** blank to use the built-in default list. Supply a
comma-separated list to *replace* the defaults entirely (not merge with
them) — if you want your own keys masked in addition to the built-in ones,
include the built-in names you still want alongside your additions.

See [masking.md](masking.md) for the full algorithm: exact-match-only key
comparison, length-preserving masks, and how nested objects/arrays under a
sensitive key are handled.

## Choosing values by scenario

- **Support/read-only dashboard shown to non-engineers:** keep masking on,
  keep Initial View as Tree, keep Initial Expand Depth at `1` so nothing
  sensitive-looking is expanded by default even before masking is
  double-checked.
- **Developer-only integration debugging page, behind its own
  authorization scheme:** consider `Enable Masking = No` only if the page is
  already restricted to engineers who are authorized to see the raw
  payload, and document why in that page's own access-control notes.
- **Very large integration logs (near or over 1 MiB):** raise Maximum
  Display Size deliberately rather than leaving developers to wonder why
  the viewer shows a "too large" message; if you are near the 5 MiB hard
  ceiling, prefer a dedicated log/file viewer instead.
