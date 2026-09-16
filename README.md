# PayloadLens for Oracle APEX

[![CI](https://github.com/B2DEV-TECH/apex-payload-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/B2DEV-TECH/apex-payload-lens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An open-source Oracle APEX **region plugin** for inspecting, searching,
masking, and reviewing integration JSON payloads — directly inside your
APEX application, with no data ever leaving the page.

Built for the everyday reality of maintaining integrations: a support
engineer needs to see what an inbound webhook actually contained, a
developer needs to compare a request against its response, and neither of
them should have to paste a production payload into an external tool (or
into their browser's DevTools) to do it — especially when that payload
contains a customer's email address, an API token, or a bank account
number.

## Why

Most APEX applications that talk to external systems end up with the same
ad hoc solution to "let me see the raw JSON": a `p_debug` page item, an
`APEX_DEBUG.MESSAGE` call, or a raw `<pre>` tag dumping `CLOB` content
straight into the page. None of those give you search, a collapsible tree,
a code view, or protect the people looking at the screen from a token or
password sitting in plain sight in the payload. PayloadLens is that missing
piece: a small, self-contained, security-conscious viewer built specifically
for this job.

## Features

- **Tree view** — collapsible, syntax-aware rendering of the payload
  structure, with a configurable initial expand depth.
- **Code view** — pretty-printed, syntax-highlighted JSON.
- **Search** — find matches across the payload with next/previous
  navigation and a live match count.
- **Copy** — copy the active view's content to the clipboard.
- **Automatic masking** — sensitive fields (passwords, tokens, API keys,
  account/routing numbers, email addresses, tax ids, and more) are masked
  before anything reaches the screen. Fully configurable — see
  [docs/masking.md](docs/masking.md).
- **Well-defined empty and error states** — `null`, missing, empty string,
  empty object/array, and invalid JSON each get their own clear message;
  there is no "blank screen" outcome.
- **Payload metadata** — size, property count, array element count, and
  max nesting depth, computed without ever exposing masked field content.
- **Multi-instance safe** — put a request and a response PayloadLens region
  side by side on the same page; they never interfere with each other.
- **Zero runtime dependencies** — no jQuery, no external JS library. A
  single small script and stylesheet.
- **Security-first rendering** — every value (and every key) reaches the
  DOM only as inert text, never as parsed HTML. See
  [docs/security.md](docs/security.md) for exactly how, and how it's
  tested.

## Requirements

- Oracle APEX **26.1 or later**. The plugin and the demo application are
  genuine APEX exports written by APEX 26.1.0, and APEX does not import
  files produced by a release newer than the one installed; 26.1.0 is also
  the only release this version has been installed and tested on.
- No other plugin or database option dependencies. The render package needs
  nothing beyond the parsing schema's ability to create a package.

## Installation

Two files, in this order — the PL/SQL render package into the application's
parsing schema, then the plugin export into the application:

```sh
# 1. the render package (run as the parsing schema)
sql -S your_parsing_schema/your_password@your_connect_string @plugin/payload_lens_pkg.sql
```

```sql
-- 2. the plugin: import plugin/region_type_plugin_b2devtech_payload_lens.sql
--    through App Builder -> Shared Components -> Plug-ins -> Import, or
--    scripted (SQLcl, same schema) by pointing apex_application_install at
--    the target application first:
begin
    apex_application_install.set_workspace('YOUR_WORKSPACE');
    apex_application_install.set_application_id(100);
    apex_application_install.generate_offset;
end;
/
@plugin/region_type_plugin_b2devtech_payload_lens.sql
```

Full instructions — including the demo application, upgrading, and
uninstalling — are in [docs/installation.md](docs/installation.md).

## Quick example

Add a region of type **PayloadLens**, give it a Static ID, and tell it where
the JSON comes from with the **Source Type** attribute: a **Static Value**
(pasted JSON, substitution strings allowed), an **Item** (the region follows
a page item without a submit), or a **PL/SQL Function Body** — for example,
a column from your integration log table:

```sql
-- Source Type: PL/SQL Function Body
return (select payload_clob
        from   integration_log
        where  log_id = :P1_LOG_ID);
```

That's it; PayloadLens handles parsing, masking, and rendering from there.

Want to see it working before wiring up a real data source?
[`demo/payloadlens_demo_app.sql`](demo/payloadlens_demo_app.sql) is a
complete demo application (plugin included) with three pages: a synthetic
`order.created` webhook with masking on, an **Integration Log** whose report
rows load their payload into an *Item*-sourced region through a Dynamic
Action and `payloadLens.refresh()` (no page submit), and a **Request vs
Response** page with two regions side by side. The [`demo/`](demo) folder
also has ready-made JSON fixtures (an "Invoice Processing Integration"
example using
only `example.com` / `example.test` data) covering a normal request/response
pair, an error response, a deeply nested example, and an intentionally
invalid JSON file — paste any of them into a **Static Value** region to see
every feature in action.

## Documentation

| Doc | Covers |
| --- | --- |
| [docs/installation.md](docs/installation.md) | Installing the plugin, importing the demo application, adding your first region |
| [docs/configuration.md](docs/configuration.md) | Every Page Designer attribute, in depth |
| [docs/masking.md](docs/masking.md) | Exactly how sensitive-field masking works |
| [docs/javascript-api.md](docs/javascript-api.md) | The `payloadLens` JavaScript API, for custom Dynamic Actions |
| [docs/security.md](docs/security.md) | The threat model and how rendering is kept XSS-safe |
| [docs/architecture.md](docs/architecture.md) | How the PL/SQL and JavaScript layers fit together |

## Development

```sh
npm install
npm test                    # runs the Vitest suite (masking, parsing, metadata, XSS-safety)
npm run build               # bundles src/ into dist/payload-lens.min.{js,css}
npm run sync:plugin-files   # embeds dist/ into the two APEX exports (plugin + demo app)
npm run check:plugin-files  # fails if the embedded files drifted from dist/ (CI runs this)
```

The JavaScript and CSS live in `src/`; the APEX exports under `plugin/` and
`demo/` embed the built `dist/` files, so after changing `src/` run the
build and the sync before committing. See [CONTRIBUTING.md](CONTRIBUTING.md)
before opening a pull request, particularly the constraints around masking
and rendering safety.

## Security

Please report suspected vulnerabilities privately — see
[SECURITY.md](SECURITY.md). Do not open a public issue for a security
report.

## License

[MIT](LICENSE) © 2026 B2DEV TECH
