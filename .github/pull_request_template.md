## What does this change?

A short description of the change and why it's needed. Link the issue it
addresses, if any.

## Checklist

- [ ] I read [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] `npm test` passes locally.
- [ ] `npm run build` succeeds locally.
- [ ] I added or updated tests under `tests/` for any behavior change.
- [ ] I updated the relevant doc under `docs/` (or `README.md`) if this
      changes configured behavior, the JavaScript API, or the security
      model.
- [ ] I added an entry under **Unreleased** in `CHANGELOG.md`.
- [ ] Any example/fixture data I added is fully synthetic
      (`example.com` / `example.test`) — no real customer data, no
      proprietary code, no production payloads.

## Does this touch rendering, parsing, or masking?

If yes, briefly explain how you verified it doesn't introduce a way for
payload content to be rendered as live markup, or for a masked value to
leak — see [docs/security.md](../docs/security.md). If no, you can remove
this section.

## Screenshots / recordings (optional)

If this is a visible UI change, a before/after screenshot helps reviewers.
