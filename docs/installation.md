# Installation

PayloadLens ships as a standard Oracle APEX region plugin: a single
`.sql` export file you import through Page Designer or SQL*Plus/SQLcl, plus
its bundled JavaScript and CSS. There is no separate application server,
no database objects beyond the plugin definition itself, and no external
service dependency.

## Requirements

- Oracle APEX **24.2 or later**. The plugin targets the modern (v2)
  region-type plugin architecture and is actively verified against APEX
  26.x during development.
- A workspace and schema you have Page Designer / SQL Workshop access to.
- No additional PL/SQL grants beyond what any other custom plugin needs
  (the ability to install plugins into your workspace).

PayloadLens has no dependency on any other plugin, any Oracle Database
option, or any JavaScript library — it is a single self-contained script and
stylesheet.

## Option 1 — Import via Page Designer / App Builder

1. Download the latest plugin export
   (`plugin/payload_lens_plugin.sql`) from a
   [release](https://github.com/B2DEV-TECH/apex-payload-lens/releases) or
   from this repository.
2. In your target application, go to **App Builder → Shared Components →
   Plug-ins**.
3. Click **Import**, choose the downloaded `.sql` file, and click **Next**.
4. Review the import summary, then click **Install Plug-in**.

The plugin is now available to every page in that application under
**Region Type → PayloadLens**.

## Option 2 — Install via SQLcl / SQL*Plus

If you prefer scripting the install (for example, as part of an automated
environment build):

```sh
sql -S your_schema/your_password@your_connect_string @plugin/payload_lens_plugin.sql
```

Run this while connected as the schema that owns the target application
(the same connection you would use for any other APEX component export).
The script is idempotent in the sense that re-running it against the same
application re-installs (updates) the plugin definition, matching the
behavior of any other APEX plugin export.

## Adding a PayloadLens region to a page

1. In Page Designer, right-click the page's **Regions** node and choose
   **Create Region**.
2. Set **Type** to **PayloadLens**.
3. Give the region a **Static ID** — PayloadLens uses this to build its DOM
   mount point and to keep multiple PayloadLens regions on the same page
   independent of each other, so it must be unique on the page.
4. Under **Source**, choose how the region gets its JSON payload:
   - **Static / SQL / PL-SQL Expression** — the normal APEX region source:
     point it at a column, a `PL/SQL Expression`, or a `Function Body
     returning SQL/CLOB`, whatever already returns your JSON text.
   - **Page/Application Item** — point it at an existing item that holds
     JSON text (for example, one populated by a preceding AJAX callback or
     Dynamic Action).
5. Adjust the **Display** and **Masking** attributes as needed — see
   [configuration.md](configuration.md) for the full reference.
6. Save and run the page.

## Verifying the install

After adding a region, running the page should show the PayloadLens toolbar
(view switch, search, copy) followed by either the rendered tree/code view
of your payload, or one of the plugin's explicit empty/error states if the
source resolved to nothing or to invalid JSON — see
[architecture.md](architecture.md#parsing-model) for exactly what those
states look like and when each one appears.

If the region renders nothing at all (not even the toolbar), check that:

- the region's **Static ID** is set (PayloadLens requires it to build its
  mount point),
- the browser console shows no JavaScript errors from another plugin or
  page-level script that might be interfering with page load, and
- you are running APEX 24.2 or later, per the [Requirements](#requirements)
  above.

## Trying it with the bundled demo data

This repository's [`demo/`](../demo) folder contains synthetic, non-real
JSON fixtures (an "Invoice Processing Integration" example using only
`example.com`/`example.test` data) you can paste directly into a region's
**Source** as a `PL/SQL Expression` returning a CLOB literal, to try every
feature — the tree view, code view, search, masking, and the invalid-JSON
and empty-payload states — without needing a real integration in place.
See each file's contents for what it demonstrates.

## Uninstalling

**Shared Components → Plug-ins**, select **PayloadLens**, and click
**Delete**. APEX prevents deleting a plugin that is still in use by an
existing region — remove or change the type of any PayloadLens regions
first.
