# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial PayloadLens v1.0 MVP: an Oracle APEX region plugin to inspect,
  search, mask, and review integration JSON payloads.
- Tree view with expand/collapse, syntax-aware value rendering, and a
  configurable initial expand depth.
- Code (pretty-printed) view with syntax highlighting.
- In-viewer search with match count and next/previous navigation.
- Copy-to-clipboard for the active view.
- Automatic masking of sensitive fields (passwords, tokens, API keys,
  account/routing numbers, email, tax ids, and more), with configurable
  key list, case sensitivity, and mask character — see `docs/masking.md`.
- Explicit, well-defined empty states (`null`, `undefined`, empty string,
  empty object, empty array) and an invalid-JSON error state, so a
  PayloadLens region never renders a blank or confusing screen.
- A configurable "Max Display Bytes" safeguard, with a hard 5 MiB
  ceiling, to keep an oversized payload from freezing the page.
- Payload metadata bar (size, property count, array element count, max
  nesting depth), computed without ever exposing masked field content.
- Multi-instance isolation: any number of PayloadLens regions can coexist
  on the same APEX page without interfering with each other.
- JavaScript public API (`init`, `refresh`, `setPayload`, `expandAll`,
  `collapseAll`, `destroy`) for custom Dynamic Action integrations — see
  `docs/javascript-api.md`.
- The plugin packaged as a genuine APEX plugin export
  (`plugin/region_type_plugin_b2devtech_payload_lens.sql`, APEX 26.1) with
  the PL/SQL render package in `plugin/payload_lens_pkg.sql`; three payload
  sources: Static Value, Item, and PL/SQL Function Body.
- A complete demo application export (`demo/payloadlens_demo_app.sql`,
  APEX 26.1) with three pages: a synthetic `order.created` webhook with
  masking on, an *Integration Log* (classic report whose rows load their
  payload into an *Item*-sourced region through a Dynamic Action and
  `payloadLens.refresh()`, no page submit) and a *Request vs Response*
  comparison with two regions side by side — plus synthetic JSON fixtures
  (`demo/*.json`) built around an "Invoice Processing Integration" example.
  All `example.com`/`example.test` data.
- `scripts/sync-plugin-files.mjs`, which embeds `dist/` into both APEX
  exports byte-for-byte and doubles as a drift check
  (`npm run check:plugin-files`).
- Full documentation set: installation, configuration, masking,
  JavaScript API, security, and architecture.
- Automated test suite (masking, parsing, metadata, and behavioral XSS
  safety tests) running under Vitest with `happy-dom`.
- GitHub Actions CI running the test suite, the build, and the embedded
  plugin files drift check on every push and pull request.
