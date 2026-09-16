# Masking

PayloadLens masks sensitive values before anything reaches the DOM, the
search index, or the clipboard. This document describes exactly how that
masking works, so you can predict what a viewer will and won't see.

Masking is implemented by a single pure function, `maskPayload(value,
options)`, in `src/js/payload-lens.js`. It has no dependency on the DOM and
is covered by `tests/masking.test.js`.

## When masking runs

Masking runs once, immediately after a payload is parsed and classified, and
before the result is handed to tree building, code-view tokenizing, or the
search indexer. The tree view, the code view, and search all operate on the
*masked* value — there is no code path where an unmasked sensitive value is
ever placed into the DOM, into `textContent`, or into a copy-to-clipboard
buffer. The one exception is the metadata bar (size, property count, array
element count, max depth): those figures are computed from the *original,
unmasked* value, because they report structure and counts only, never any
value content.

Masking can be disabled entirely for an instance by setting
`enableMasking: false` in the `init()` config (see
[javascript-api.md](javascript-api.md)) — useful for a developer-only debug
page where you explicitly want to see raw values, never appropriate for a
page end users can reach.

## Which keys are treated as sensitive

By default, an object key is sensitive if it exactly matches one of these
built-in names (case-insensitively, see below):

```
password, passwd, token, access_token, refresh_token, authorization,
apikey, api_key, secret, accountnumber, bankaccount, routingnumber,
email, taxid
```

This list is exported as `payloadLens._internal.DEFAULT_SENSITIVE_KEYS` and
is intentionally short and specific rather than trying to guess at every
possible secret-sounding name — false negatives are safer to iterate on
(add the key to `sensitiveKeys`) than false positives that hide legitimate
business data a developer needed to see.

You can override the list per-instance with the `sensitiveKeys` option, or
extend it by passing your own array that includes both the defaults and
your additions.

### Matching is exact, not substring

A key must **exactly** equal one of the sensitive names to be masked. A key
like `passwordHint` or `emailVerified` is left untouched, because it is a
different key, not a "sensitive-ish" one. This avoids surprising
over-masking of fields like `tokenType` or `emailPreferences` that merely
contain a sensitive word as a substring.

### Case sensitivity

By default, matching is case-insensitive: `PASSWORD`, `Password`, and
`password` are all treated as the same sensitive key. Pass
`caseSensitiveMasking: true` to require an exact-case match instead — useful
if your payloads deliberately use two differently-cased keys with different
meanings (rare, but the option exists for that case).

## How a masked value is built

When a key is recognized as sensitive, what happens next depends on the
*shape* of that key's value:

- **Scalar value** (string, number, boolean) — replaced with a string of
  mask characters, the same length as the original value's string form,
  clamped between 3 and 32 characters. A one-character token becomes `***`
  (padded up to the 3-character minimum, so its length can't be inferred as
  "this secret is unusually short"); a 500-character token becomes 32
  characters (capped, so its length can't be inferred as "this secret is
  unusually long" either).
- **`null` or `undefined` value** — left as-is. There's nothing to leak by
  showing that a field is absent, and masking `null` would misleadingly
  suggest a real secret is present.
- **Nested object value** (e.g. `"token": { "value": "abc", "issuedAt": ... }`)
  — the entire subtree is collapsed into a single masked string. Once a key
  itself is flagged sensitive, PayloadLens does not try to decide which of
  its descendants are "sensitive enough" to show — the key already told us
  the developer does not want this shown at all.
- **Nested array value** (e.g. `"token": ["abc", "def"]`) — unlike an
  object, the array shape is preserved: each element is masked
  individually (length-preserving, per the scalar/object/array rules above,
  recursively), so you can still see, for example, that a sensitive field
  held a two-element array, without seeing what those elements were.

Masking always recurses into every object and array in the payload,
regardless of nesting depth, so a sensitive key several levels deep (for
example, `customer.paymentInstructions.accountNumber`) is masked exactly the
same as a top-level one.

## Custom mask character

By default the mask character is `*`. Pass `maskChar` in the `init()` config
to use a different character (only the first character of the string you
pass is used, e.g. `maskChar: '#'` produces `######`).

## Non-mutation guarantee

`maskPayload` never modifies the value you pass in — it always returns a new
structure, deep-cloning everything it doesn't need to mask. This matters if
you call `payloadLens.setPayload()` with a JavaScript object you still hold
a reference to elsewhere in your page's code: PayloadLens will never
reach back into that object and mask it in place.

## What masking does not do

- It does not inspect *values* for secret-looking content (API key
  patterns, credit card numbers, etc.) — only *key names* are checked. A
  field named `note` containing a pasted API key is not masked.
- It does not persist any notion of "this was masked" back to the server —
  masking is a purely client-side display concern, applied fresh on every
  render.
- It is not a substitute for not sending sensitive data to the browser in
  the first place. If a payload should never reach the client at all,
  redact it server-side before it becomes the region's source; PayloadLens
  protects what a developer or support engineer *sees* on screen, not what
  travels over the wire.
