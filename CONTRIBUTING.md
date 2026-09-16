# Contributing to PayloadLens

Thanks for considering a contribution. PayloadLens is a small, focused
project by design — please read this before opening a large pull request,
so we can agree on direction before you invest a lot of time.

## Ground rules

- Be respectful and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- No real customer data, no proprietary code, and no production payloads in
  issues, pull requests, or demo fixtures — ever. Use synthetic examples
  with `example.com` / `example.test` domains, the same way the existing
  [`demo/`](demo) fixtures do.
- Security reports do not belong in public issues — see
  [SECURITY.md](SECURITY.md).

## Getting set up

```sh
git clone https://github.com/B2DEV-TECH/apex-payload-lens.git
cd apex-payload-lens
npm install
npm test
```

Requirements: Node.js 20+ and an Oracle APEX 24.2+ instance if you want to
test the plugin end-to-end (not required just to run the JS test suite).

## Project layout

See [docs/architecture.md](docs/architecture.md) for the full picture. In
short: `src/js/payload-lens.js` and `src/css/payload-lens.css` are the
hand-written client library; `plugin/` is the installable APEX plugin
definition; `dist/` holds the built, minified assets embedded into that
plugin; `tests/` is the Vitest suite; `demo/` and `docs/` are fixtures and
documentation.

## Making a change

1. Open an issue first for anything beyond a small fix — a bug report, or a
   short proposal for a new feature — so we can discuss the approach before
   code is written. This is especially true for anything touching masking
   or rendering, given their security role (see
   [docs/security.md](docs/security.md)).
2. Create a branch off `main` for your change.
3. Keep `src/js/payload-lens.js` dependency-free and free of `innerHTML`,
   `eval`, or `new Function(...)` — this is a hard architectural
   constraint, not a style preference. See
   [docs/security.md](docs/security.md#how-rendering-avoids-xss-no-innerhtml-ever).
4. Add or update tests under `tests/` for any behavior change. A change to
   masking rules, parsing/empty-state classification, or rendering safety
   should come with a test that would fail without your fix.
5. Run the full test suite and the build before opening a pull request:

   ```sh
   npm test
   npm run build
   ```

6. Update the relevant doc under `docs/` if your change affects configured
   behavior, the JavaScript API, or the security model. Add an entry under
   **Unreleased** in [CHANGELOG.md](CHANGELOG.md).

## Pull requests

- Keep pull requests focused on one change. Large, mixed-purpose PRs are
  harder to review and more likely to be asked to split up.
- Describe *why* the change is needed, not just what it does — link the
  issue it addresses where applicable.
- CI (test suite + build) must pass before a PR can be merged.

## Reporting bugs / requesting features

Please use the issue templates provided in this repository — they ask for
the information needed to reproduce a bug or evaluate a feature request
efficiently.
