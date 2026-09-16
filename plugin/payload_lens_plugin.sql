set define off
set verify off
prompt --application/create_plugin/payload_lens_plugin
--------------------------------------------------------------------------------
-- PayloadLens for Oracle APEX -- plug-in registration script
-- https://github.com/B2DEV-TECH/apex-payload-lens
-- Copyright (c) B2DEV TECH. Released under the MIT License.
--
-- Installs (or updates, since every id is a fixed wwv_flow_imp.id() literal)
-- the PAYLOAD_LENS region plug-in. Every Oracle APEX plug-in row belongs to
-- an owning application (FLOW_ID) even though it can later be used by any
-- application in the workspace via "Subscription"/copy -- this matches the
-- real "Export Plug-in" script produced by App Builder, which always runs
-- with p_default_application_id bound to whatever application you export
-- it from. Here that is the PayloadLens Demo application (created by
-- plugin/create_demo_app.sql) so the plug-in has a real home to develop
-- and test against.
--
-- Run as: the PAYLOADLENS APEX workspace's parsing schema, via SQLPlus/SQLcl,
-- OR via the APEX Application Builder's "Import Plug-in" UI (Shared
-- Components > Plug-ins > Import) from within any target application.
--
-- Regenerate plugin/payload_lens_files.sql (the JS/CSS payload) first with:
--   npm run build && npm run build:plugin-files
--------------------------------------------------------------------------------

declare
    l_plugin_id number;

    l_attr_source_type             number;
    l_attr_source_static           number;
    l_attr_source_item             number;
    l_attr_source_plsql            number;
    l_attr_display_mode            number;
    l_attr_initial_expand_depth    number;
    l_attr_enable_search           number;
    l_attr_enable_copy             number;
    l_attr_enable_metadata         number;
    l_attr_enable_masking          number;
    l_attr_sensitive_keys          number;
    l_attr_case_sensitive_masking  number;
    l_attr_mask_character          number;
    l_attr_max_display_bytes       number;
begin
    wwv_flow_imp.component_begin(
        p_version_yyyy_mm_dd      => '2025.09.15',
        p_release                 => '26.1.0',
        p_default_workspace_id    => 16201359295616937,
        p_default_application_id => 4471082935610274 );

    ----------------------------------------------------------------------
    -- Plug-in
    ----------------------------------------------------------------------
    l_plugin_id := wwv_flow_imp.id(5750252144018392);

    wwv_flow_imp.create_plugin(
        p_id                    => l_plugin_id,
        p_plugin_type           => 'REGION TYPE',
        p_name                  => 'B2DEVTECH.PAYLOAD_LENS',
        p_display_name          => 'PayloadLens',
        p_category              => 'Reports',
        p_supported_ui_types    => 'DESKTOP',
        p_api_version           => 1,
        p_render_function       => 'payload_lens_pkg.render',
        p_substitute_attributes => true,
        p_subscribe_plugin_settings => false,
        p_help_text             => 'Renders an integration/API JSON payload as an interactive, searchable, maskable tree or code view. See https://github.com/B2DEV-TECH/apex-payload-lens for full documentation.',
        p_version_identifier    => '1.0.0',
        p_about_url             => 'https://github.com/B2DEV-TECH/apex-payload-lens',
        p_files_version         => 1 );

    ----------------------------------------------------------------------
    -- Attribute 01: Source Type
    ----------------------------------------------------------------------
    l_attr_source_type := wwv_flow_imp.id(2431650621746597);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_source_type,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 1,
        p_display_sequence   => 10,
        p_prompt             => 'Source Type',
        p_attribute_type     => 'SELECT LIST',
        p_is_required        => true,
        p_is_common          => true,
        p_default_value      => 'STATIC',
        p_lov_type           => 'STATIC',
        p_is_translatable    => false,
        p_help_text          => 'Where PayloadLens reads the JSON payload from: a static value entered below (with substitutions like &ITEM_NAME. resolved), a page/application item read live in the browser, or a PL/SQL Function Body evaluated when the region renders.' );

    wwv_flow_imp.create_plugin_attr_value(
        p_id                  => wwv_flow_imp.id(6806936905444769),
        p_plugin_attribute_id => l_attr_source_type,
        p_display_sequence    => 10,
        p_display_value       => 'Static Value',
        p_return_value        => 'STATIC' );

    wwv_flow_imp.create_plugin_attr_value(
        p_id                  => wwv_flow_imp.id(9671859233098400),
        p_plugin_attribute_id => l_attr_source_type,
        p_display_sequence    => 20,
        p_display_value       => 'Item',
        p_return_value        => 'ITEM' );

    wwv_flow_imp.create_plugin_attr_value(
        p_id                  => wwv_flow_imp.id(2360928096514430),
        p_plugin_attribute_id => l_attr_source_type,
        p_display_sequence    => 30,
        p_display_value       => 'PL/SQL Function Body',
        p_return_value        => 'PLSQL_FUNCTION_BODY' );

    ----------------------------------------------------------------------
    -- Attribute 02: Source Static
    ----------------------------------------------------------------------
    l_attr_source_static := wwv_flow_imp.id(2287375844472375);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_source_static,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 2,
        p_display_sequence   => 20,
        p_prompt             => 'Source Static',
        p_attribute_type     => 'TEXTAREA',
        p_is_required        => false,
        p_is_common          => true,
        p_is_translatable    => false,
        p_help_text          => 'Used when Source Type is Static Value. Enter the raw JSON payload text. Item and application substitutions such as &P1_ITEM. are resolved before display.' );

    ----------------------------------------------------------------------
    -- Attribute 03: Source Item
    ----------------------------------------------------------------------
    l_attr_source_item := wwv_flow_imp.id(2990172045918383);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_source_item,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 3,
        p_display_sequence   => 30,
        p_prompt             => 'Source Item',
        p_attribute_type     => 'PAGE ITEM',
        p_is_required        => false,
        p_is_common          => true,
        p_is_translatable    => false,
        p_help_text          => 'Used when Source Type is Item. Name of the page or application item holding the JSON payload. Its live value is read in the browser at render/refresh time -- the value is never sent through the server for this option.' );

    ----------------------------------------------------------------------
    -- Attribute 04: Source PL/SQL
    ----------------------------------------------------------------------
    l_attr_source_plsql := wwv_flow_imp.id(4297509410986589);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_source_plsql,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 4,
        p_display_sequence   => 40,
        p_prompt             => 'Source PL/SQL Function Body',
        p_attribute_type     => 'PLSQL FUNCTION BODY',
        p_is_required        => false,
        p_is_common          => true,
        p_is_translatable    => false,
        p_help_text          => 'Used when Source Type is PL/SQL Function Body. Enter a PL/SQL fragment that returns a CLOB or VARCHAR2 containing the JSON payload. Any exception is caught and shown in the region as a diagnostic message instead of failing the page.' );

    ----------------------------------------------------------------------
    -- Attribute 05: Display Mode
    ----------------------------------------------------------------------
    l_attr_display_mode := wwv_flow_imp.id(9838380986353440);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_display_mode,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 5,
        p_display_sequence   => 50,
        p_prompt             => 'Display Mode',
        p_attribute_type     => 'SELECT LIST',
        p_is_required        => true,
        p_is_common          => true,
        p_default_value      => 'tree',
        p_lov_type           => 'STATIC',
        p_is_translatable    => false,
        p_help_text          => 'Initial view shown for the payload: an expandable/collapsible Tree View, or a syntax-highlighted, read-only Code View. The end user can switch views at any time from the region toolbar.' );

    wwv_flow_imp.create_plugin_attr_value(
        p_id                  => wwv_flow_imp.id(7193407210108706),
        p_plugin_attribute_id => l_attr_display_mode,
        p_display_sequence    => 10,
        p_display_value       => 'Tree View',
        p_return_value        => 'tree' );

    wwv_flow_imp.create_plugin_attr_value(
        p_id                  => wwv_flow_imp.id(1369572156632499),
        p_plugin_attribute_id => l_attr_display_mode,
        p_display_sequence    => 20,
        p_display_value       => 'Code View',
        p_return_value        => 'code' );

    ----------------------------------------------------------------------
    -- Attribute 06: Initial Expand Depth
    ----------------------------------------------------------------------
    l_attr_initial_expand_depth := wwv_flow_imp.id(5939151731985907);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_initial_expand_depth,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 6,
        p_display_sequence   => 60,
        p_prompt             => 'Initial Expand Depth',
        p_attribute_type     => 'TEXT',
        p_is_required        => false,
        p_is_common          => false,
        p_default_value      => '2',
        p_max_length         => 10,
        p_is_translatable    => false,
        p_help_text          => 'How many levels of the Tree View are expanded when the region first renders. Enter a positive whole number, or ALL to fully expand the payload. Ignored in Code View.' );

    ----------------------------------------------------------------------
    -- Attribute 07: Enable Search
    ----------------------------------------------------------------------
    l_attr_enable_search := wwv_flow_imp.id(7308484895430496);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_enable_search,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 7,
        p_display_sequence   => 70,
        p_prompt             => 'Enable Search',
        p_attribute_type     => 'CHECKBOX',
        p_is_required        => false,
        p_is_common          => true,
        p_default_value      => 'Y',
        p_is_translatable    => false,
        p_help_text          => 'Show the search box in the region toolbar, letting end users find and step through matching keys/values.' );

    ----------------------------------------------------------------------
    -- Attribute 08: Enable Copy
    ----------------------------------------------------------------------
    l_attr_enable_copy := wwv_flow_imp.id(7179139510041966);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_enable_copy,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 8,
        p_display_sequence   => 80,
        p_prompt             => 'Enable Copy',
        p_attribute_type     => 'CHECKBOX',
        p_is_required        => false,
        p_is_common          => true,
        p_default_value      => 'Y',
        p_is_translatable    => false,
        p_help_text          => 'Show a Copy button that copies the (masked, if masking is enabled) payload to the clipboard as formatted JSON.' );

    ----------------------------------------------------------------------
    -- Attribute 09: Enable Metadata
    ----------------------------------------------------------------------
    l_attr_enable_metadata := wwv_flow_imp.id(7027849542931913);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_enable_metadata,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 9,
        p_display_sequence   => 90,
        p_prompt             => 'Enable Metadata',
        p_attribute_type     => 'CHECKBOX',
        p_is_required        => false,
        p_is_common          => false,
        p_default_value      => 'Y',
        p_is_translatable    => false,
        p_help_text          => 'Show a small metadata bar above the payload (size, key/node counts, and similar summary information).' );

    ----------------------------------------------------------------------
    -- Attribute 10: Enable Masking
    ----------------------------------------------------------------------
    l_attr_enable_masking := wwv_flow_imp.id(5020115360724264);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_enable_masking,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 10,
        p_display_sequence   => 100,
        p_prompt             => 'Enable Masking',
        p_attribute_type     => 'CHECKBOX',
        p_is_required        => false,
        p_is_common          => true,
        p_default_value      => 'Y',
        p_is_translatable    => false,
        p_help_text          => 'Mask the values of sensitive keys (see Sensitive Keys) before the payload is ever rendered into the DOM. Masking happens entirely in the browser, before display -- it does not alter the source data.' );

    ----------------------------------------------------------------------
    -- Attribute 11: Sensitive Keys
    ----------------------------------------------------------------------
    l_attr_sensitive_keys := wwv_flow_imp.id(2515162876743785);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_sensitive_keys,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 11,
        p_display_sequence   => 110,
        p_prompt             => 'Sensitive Keys',
        p_attribute_type     => 'TEXTAREA',
        p_is_required        => false,
        p_is_common          => false,
        p_is_translatable    => false,
        p_help_text          => 'Comma-separated list of JSON key names to mask, for example: password, cpf, creditCard, token. Leave blank to use PayloadLens'' built-in default list of common sensitive key names.' );

    ----------------------------------------------------------------------
    -- Attribute 12: Case Sensitive Masking
    ----------------------------------------------------------------------
    l_attr_case_sensitive_masking := wwv_flow_imp.id(3060174555517678);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_case_sensitive_masking,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 12,
        p_display_sequence   => 120,
        p_prompt             => 'Case Sensitive Masking',
        p_attribute_type     => 'CHECKBOX',
        p_is_required        => false,
        p_is_common          => false,
        p_default_value      => 'N',
        p_is_translatable    => false,
        p_help_text          => 'When enabled, Sensitive Keys are matched with exact case. When disabled (default), matching is case-insensitive -- for example "Password" and "PASSWORD" both match "password".' );

    ----------------------------------------------------------------------
    -- Attribute 13: Mask Character
    ----------------------------------------------------------------------
    l_attr_mask_character := wwv_flow_imp.id(3318160291605806);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_mask_character,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 13,
        p_display_sequence   => 130,
        p_prompt             => 'Mask Character',
        p_attribute_type     => 'TEXT',
        p_is_required        => false,
        p_is_common          => false,
        p_default_value      => '*',
        p_display_length     => 2,
        p_max_length         => 1,
        p_is_translatable    => false,
        p_help_text          => 'Single character used to build the masked placeholder shown in place of a sensitive value.' );

    ----------------------------------------------------------------------
    -- Attribute 14: Max Display Bytes
    ----------------------------------------------------------------------
    l_attr_max_display_bytes := wwv_flow_imp.id(5173816569498252);

    wwv_flow_imp.create_plugin_attribute(
        p_id                 => l_attr_max_display_bytes,
        p_plugin_id          => l_plugin_id,
        p_attribute_scope    => 'COMPONENT',
        p_attribute_sequence => 14,
        p_display_sequence   => 140,
        p_prompt             => 'Max Display Bytes',
        p_attribute_type     => 'NUMBER',
        p_is_required        => false,
        p_is_common          => false,
        p_default_value      => '1048576',
        p_min_value          => 1,
        p_max_value          => 5242880,
        p_is_translatable    => false,
        p_help_text          => 'Largest payload size, in bytes, PayloadLens will render (default 1 MB, hard-capped at 5 MB). Larger payloads show a warning instead of attempting to render, to protect the browser from very large documents.' );

end;
/

--------------------------------------------------------------------------------
-- Plug-in static files (generated -- see plugin/payload_lens_files.sql).
-- Runs inside the same component_begin/component_end bracket as the plugin
-- and attributes above, so wwv_flow_imp.id() resolves the same literal
-- plug-in id to the same row created above.
--------------------------------------------------------------------------------
@@payload_lens_files.sql

begin
    wwv_flow_imp.component_end;
end;
/

prompt --PayloadLens plug-in install complete.
