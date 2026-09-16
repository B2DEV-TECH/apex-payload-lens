# Security Policy

## Supported versions

PayloadLens is currently pre-1.0. Security fixes are made against the
latest released version on the `main` branch; there is no separate
long-term-support branch at this stage.

| Version | Supported |
| --- | --- |
| latest (`main`) | ✅ |
| older tags/pre-releases | ❌ |

Once PayloadLens reaches 1.0, this table will be updated to reflect the
versions that receive security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a suspected security
vulnerability.

Instead, use GitHub's private vulnerability reporting for this repository:
open the **Security** tab on
[B2DEV-TECH/apex-payload-lens](https://github.com/B2DEV-TECH/apex-payload-lens)
and click **Report a vulnerability**. This opens a private advisory visible
only to the maintainers until a fix is ready.

When reporting, please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce it, ideally with a minimal example payload or
  configuration (synthetic data only — please do not include real customer
  data or real credentials in a report).
- The PayloadLens version (or commit hash) you tested against.

## What counts as a security issue here

PayloadLens's core security promise is described in detail in
[docs/security.md](docs/security.md): payload content (including object
keys) is always rendered as inert text, never as live HTML, and sensitive
fields are masked before anything reaches the DOM. Reports that fall inside
this scope include, for example:

- Any input (a payload value, a payload key, or a plugin configuration
  value) that results in a `<script>` element, an event-handler attribute
  such as `onerror`, or any other form of executed markup appearing in the
  rendered output.
- Any way for a masked field's original value to become visible — in the
  DOM, in a copy-to-clipboard action, in the search index, or in the
  metadata bar — without masking being explicitly disabled for that
  instance.

Issues in how a *consuming application* configures page-level authorization,
or requests to treat "the region shows exactly the data its source
resolves to" as a vulnerability, are outside PayloadLens's own security
boundary — see [docs/security.md](docs/security.md#what-stays-your-responsibility).

## Response process

We aim to acknowledge new reports promptly and to keep the reporter updated
as a fix is developed. Once a fix is released, we will credit the reporter
in the release notes unless they ask to remain anonymous.
