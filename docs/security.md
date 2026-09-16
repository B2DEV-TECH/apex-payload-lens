# Security

PayloadLens exists to safely display integration payloads that were never
meant for a screen — production JSON that may contain a mix of ordinary
business data and things like tokens, account numbers, or email addresses.
Because of that, its security model is a first-class design concern, not an
afterthought. This document explains what PayloadLens protects against, how,
and what remains your responsibility.

If you believe you've found a security vulnerability in PayloadLens, please
follow the process in [SECURITY.md](../SECURITY.md) rather than opening a
public issue.

## Threat model

PayloadLens renders **untrusted string content** — a JSON payload that may
originate from an external system PayloadLens's author does not control —
directly into a page a real person looks at inside their APEX application.
The primary threat this creates is **stored/reflected cross-site scripting
(XSS)**: if an attacker can get a string like `<img src=x onerror=alert(1)>`
or `<script>alert(1)</script>` into a value or even a *key* of the payload
your integration receives, and PayloadLens ever turned that string into live
HTML, the attacker's script would execute in the context of whoever views
that APEX page — potentially an internal support engineer or administrator
with a highly privileged session.

PayloadLens is built so that this class of attack is structurally
impossible, not merely filtered.

## How rendering avoids XSS: no `innerHTML`, ever

The entire rendering path — the toolbar, the tree view, the code view, every
error and empty state — is built exclusively with `document.createElement`,
`element.setAttribute`, `element.className`, `element.addEventListener`, and
`document.createTextNode`. **`innerHTML` is never assigned anywhere in the
codebase**, and neither `eval()` nor `new Function(...)` are used anywhere.

Concretely, this means:

- Every piece of payload content — object keys, string/number/boolean/null
  values, and JSON syntax punctuation in the code view — reaches the DOM
  only via `document.createTextNode`, which the browser always treats as
  literal text, never as markup to parse. A key or value containing
  `<script>...</script>` is displayed as the visible characters
  `<script>...</script>`; it is never parsed into an actual `<script>`
  element, and no attribute like `onerror` is ever written to a live
  element from payload content.
- `tests/security.test.js` verifies this behaviorally, not just by code
  inspection: it renders both of the payloads above (and a payload where
  the *key name itself* is the dangerous string) through the real `init()`
  path in a `happy-dom` document, then asserts there are zero `<script>`
  elements, zero elements with an `onerror` attribute, and zero `<img>`
  elements anywhere in the rendered output — while confirming the literal
  attack-payload text is still visible as inert text content, proving
  PayloadLens shows the data without executing it.

## Masking runs before rendering, not after

Sensitive-looking fields (see [masking.md](masking.md) for the exact rules)
are masked in memory, on the already-parsed JavaScript value, **before**
that value is ever handed to tree building, code-view tokenizing, or the
search indexer. There is no rendering code path that touches an unmasked
sensitive value — masking is not a display-layer redaction applied to
already-rendered DOM (which would risk a flash of unmasked content, or a
value that leaks through `textContent` before a mask is painted over it).

The one deliberate exception: the metadata bar (payload size, property
count, array element count, max nesting depth) is computed from the
*original, unmasked* value, because those figures describe shape and
counts only — they never include any field's actual content, masked or not.

## No `eval`, no dynamic code execution, no remote fetches

PayloadLens's JavaScript never calls `eval`, never constructs a `Function`
from a string, and never issues its own network request (no `fetch`, no
`XMLHttpRequest`, no dynamic `<script src>` injection). It has no build-time
or runtime dependency on any third-party JavaScript library. The only
network activity involved in using PayloadLens is APEX's own normal page
load and any AJAX calls your application already makes — PayloadLens simply
renders whatever JSON text it is given.

## Client-side size limit is a safety net, not a security boundary

The "Max Display Bytes" limit (see [configuration.md](configuration.md))
exists to protect the browser tab from a pathologically large payload
freezing the page while it builds a huge DOM tree. It is a usability and
availability safeguard, not a security control — it does not, by itself,
prevent any class of injection attack, since the underlying rendering path
is already safe regardless of payload size.

## What stays your responsibility

- **Server-side redaction of anything that must never reach the browser at
  all.** PayloadLens protects what is *shown on screen*; it cannot protect
  data that a page's region source resolves and sends to the client in the
  first place. If a field must never leave the database, filter it out
  server-side before it becomes the region's source.
- **Access control on the page itself.** PayloadLens does not add or modify
  APEX authorization — a PayloadLens region is exactly as visible as any
  other region on the same page, governed by the same page-level
  authorization schemes, ACLs, and authentication you already have in
  place.
- **Choosing sensitive keys that match your actual payload shapes.** The
  built-in sensitive key list is a reasonable, narrow default (see
  [masking.md](masking.md)); it is not a claim that every possible secret
  field name is covered. Review it against your own integrations and extend
  `sensitiveKeys` as needed.

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md) for the supported versions and the
private disclosure process.
