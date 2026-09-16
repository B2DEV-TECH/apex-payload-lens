# Installation

PayloadLens ships as two files, installed in this order:

1. `plugin/payload_lens_pkg.sql` — the PL/SQL package `payload_lens_pkg`
   that renders the region. It goes into the application's **parsing
   schema**.
2. `plugin/region_type_plugin_b2devtech_payload_lens.sql` — the region-type
   plugin itself (attributes plus the embedded JavaScript and CSS), in the
   standard APEX plugin export format. It is imported into each
   **application** that uses PayloadLens.

A third file, `demo/payloadlens_demo_app.sql`, is a complete demo
application (plugin included) that you can import into any workspace to see
the region working before wiring it to your own data.

## Requirements

- **Oracle APEX 26.1 or later.** The plugin and the demo application are
  genuine APEX exports written by APEX 26.1.0 (`p_release => '26.1.0'`),
  and APEX refuses to import an export produced by a release newer than the
  one installed. APEX 26.1.0 is also the only release this version has been
  installed and tested on. The package itself only uses long-standing APIs
  (`apex_plugin`, `apex_plugin_util`, `apex_json`, `apex_css`,
  `apex_javascript`), but it has not been exercised on older releases.
- A workspace whose parsing schema can create packages (`CREATE PROCEDURE`).
  No other database privileges are needed: the package reads nothing but
  the region attributes and creates no tables, jobs, synonyms, or grants.
- For the scripted route, [SQLcl](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/)
  connected as the parsing schema. No `SYS` or `APEX_xxxxxx` access is
  needed at any step.

## Step 1 — install the PL/SQL package

Connect to the application's parsing schema and run:

```sql
@plugin/payload_lens_pkg.sql
```

or, with SQLcl in one line:

```sh
sql -S your_parsing_schema/your_password@your_connect_string @plugin/payload_lens_pkg.sql
```

Verify:

```sql
select object_name, object_type, status
from   user_objects
where  object_name = 'PAYLOAD_LENS_PKG';

-- PAYLOAD_LENS_PKG   PACKAGE        VALID
-- PAYLOAD_LENS_PKG   PACKAGE BODY   VALID
```

The plugin's render function is `payload_lens_pkg.render`, resolved at run
time through the application's parsing schema. If you prefer to keep the
package in another schema, grant `EXECUTE` on it and create a synonym in the
parsing schema (or change the plugin's *Render Procedure/Function Name*
after importing it).

## Step 2 — import the plugin

### Option A — App Builder

1. Open the application, go to **Shared Components → Plug-ins** and click
   **Import** (the same wizard is reachable from **Application → Import**
   by choosing the file type *Plug-in*).
2. Upload `plugin/region_type_plugin_b2devtech_payload_lens.sql` and finish
   the wizard.
3. The plugin now appears under **Shared Components → Plug-ins** as
   **PayloadLens** (internal name `B2DEVTECH.PAYLOAD_LENS`, category
   *Reports*, version `1.0.0`).

The file is the unmodified output of APEX's own plugin export
(`apex export -expComponents "PLUGIN:<id>"`), so it goes through the
Builder's regular plugin import. The project's own verification of this
release, however, was done through the scripted route below; the Builder
route was not separately automated.

### Option B — SQLcl / SQL\*Plus (scriptable)

The export installs into whatever application `apex_application_install`
points at. Connected as the parsing schema:

```sql
set define off
begin
    apex_application_install.set_workspace('YOUR_WORKSPACE');   -- workspace name
    apex_application_install.set_application_id(100);           -- target application id
    apex_application_install.generate_offset;
end;
/
@plugin/region_type_plugin_b2devtech_payload_lens.sql
```

Running the same script again against the same application **replaces the
plugin in place** (the export runs in `REPLACE` mode); regions already
bound to `B2DEVTECH.PAYLOAD_LENS` keep working with the new version. That is
also the upgrade path.

## Step 3 — add a region

1. In Page Designer create a region and set its **Type** to **PayloadLens**.
2. Give it a **Static ID** (for example `ORDER_PAYLOAD`). The
   [JavaScript API](javascript-api.md) addresses the instance by this id.
3. Under the region's **Attributes** pick a **Source Type**:
   - **Static Value** (default) — paste the JSON into **Source Static**.
     Substitution strings such as `&P1_ITEM.` are replaced server-side
     before the payload is parsed.
   - **Item** — choose a page or application item in **Source Item**. Its
     current value is read in the browser (`apex.item(name).getValue()`) on
     init and on every `refresh()`, so the region follows the item without a
     page submit.
   - **PL/SQL Function Body** — write a function body in **Source PL/SQL
     Function Body** that returns the JSON as `clob` (or `varchar2`), e.g.

     ```sql
     return (select payload_clob
             from   integration_log
             where  log_id = :P1_LOG_ID);
     ```

     The body runs server-side with the page's bind variables. If it raises,
     the error message is delivered as the payload and shows up in the
     region's "invalid JSON" state instead of breaking the page.
4. Leave the remaining attributes at their defaults or tune them — every
   attribute is described in [configuration.md](configuration.md).
5. Save and run the page.

## Verifying the installation

On the running page you should see:

- the PayloadLens toolbar (Tree / Code toggle, search box, Copy button) and
  the metadata bar above the rendered payload;
- in the browser's Network tab, `payload-lens.min.css` and
  `payload-lens.min.js` served from `.../files/plugin/<plugin id>/v1/`,
  both HTTP 200;
- keys such as `cardNumber`, `token`, or `apiKey` rendered masked when
  masking is enabled.

If the region renders empty, run the page in Debug mode and look for
`payload_lens_pkg` in the debug log. The usual causes are the package not
being installed (or invalid) in the parsing schema, or a PL/SQL function
body that does not end with a `return`.

## Demo application

`demo/payloadlens_demo_app.sql` is a full application export (alias
`PAYLOADLENS_DEMO`, Universal Theme, *No Authentication*, plugin embedded)
with three pages, all reachable from its navigation menu:

- **Home** (page 1) — a synthetic `order.created` webhook in a *Static
  Value* region with masking enabled for `cardNumber, token, apiKey,
  webhookSignature, authCode`, plus the full toolbar (Tree / Code, search,
  expand and collapse, Copy, per-node JSON path).
- **Integration Log** (page 2) — a classic report over six invented
  integration calls (an inline `WITH` clause, no table) next to an
  *Item*-sourced region. Clicking **View** on a row runs a Dynamic Action
  that stores the row id in a hidden item, reads that row's payload through
  `apex_region.open_query_context` into a second hidden item, and calls
  `payloadLens.refresh('LOG_PAYLOAD')` — the region re-renders without a
  page submit. One row is a deliberately truncated body, to show the
  invalid-JSON state.
- **Request vs Response** (page 3) — two regions side by side showing the
  `demo/invoice-request.json` / `demo/invoice-response.json` pair with the
  built-in sensitive-key list (no *Sensitive Keys* override).

Every value in it is invented (`example.com` addresses only).

Import it as a **new** application:

- **App Builder:** **Application → Import**, upload
  `demo/payloadlens_demo_app.sql` (file type *Database Application*), and
  in the install step choose a new application id and your parsing schema.
- **SQLcl**, connected as the parsing schema (the id / alias / schema lines
  are optional — omit them to keep the values stored in the export):

  ```sql
  set define off
  begin
      apex_application_install.set_workspace('YOUR_WORKSPACE');
      apex_application_install.set_schema('YOUR_PARSING_SCHEMA');
      apex_application_install.set_application_id(101);
      apex_application_install.set_application_alias('PAYLOADLENS_DEMO');
      apex_application_install.generate_offset;
  end;
  /
  @demo/payloadlens_demo_app.sql
  ```

Then make sure `payload_lens_pkg` is installed in that parsing schema
(Step 1) and run the application — with ORDS the friendly URLs are
`/ords/r/<workspace-path-prefix>/payloadlens_demo/1`,
`.../payloadlens_demo/integration-log` and
`.../payloadlens_demo/request-vs-response` (the path prefix defaults to the
workspace name in lower case).

The JSON fixtures in `demo/` (an invoice request/response pair — the two
files page 3 renders — an integration error, a deeply nested example, and
an intentionally invalid file) are the same kind of synthetic content,
ready to paste into a **Static Value** region.

## Uninstalling

1. Delete (or change the type of) every region that uses PayloadLens —
   APEX will not delete a plugin that is still in use.
2. **Shared Components → Plug-ins → PayloadLens → Delete**.
3. In the parsing schema: `drop package payload_lens_pkg;`

Nothing else was created by the installation.
