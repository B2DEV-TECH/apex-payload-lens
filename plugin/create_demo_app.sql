set define off
set verify off
prompt --application/create_application/payload_lens_demo_app
--------------------------------------------------------------------------------
-- PayloadLens for Oracle APEX -- minimal demo application
-- https://github.com/B2DEV-TECH/apex-payload-lens
-- Copyright (c) B2DEV TECH. Released under the MIT License.
--
-- Creates a small, real application in the PAYLOADLENS workspace. Plug-ins
-- always belong to an owning application (FLOW_ID) even when later shared
-- across the workspace, so this app exists to host the PayloadLens plug-in
-- during development and to carry the synthetic demo page that exercises
-- it end-to-end. Entirely synthetic content; safe to drop and recreate.
--------------------------------------------------------------------------------

declare
    l_app_id number;
begin
    wwv_flow_imp.import_begin(
        p_version_yyyy_mm_dd   => '2025.09.15',
        p_release              => '26.1.0',
        p_default_workspace_id => 16201359295616937,
        p_default_owner        => 'PAYLOADLENS');

    l_app_id := wwv_flow_imp.id(4471082935610274);

    wwv_flow_imp.create_flow(
        p_id             => l_app_id,
        p_owner          => 'PAYLOADLENS',
        p_name           => 'PayloadLens Demo',
        p_alias          => 'PAYLOADLENS_DEMO',
        p_flow_language  => 'en',
        p_build_status   => 'RUN_AND_BUILD');

    wwv_flow_imp.create_page(
        p_id                 => 1,
        p_flow_id            => l_app_id,
        p_name               => 'Home',
        p_step_title         => 'PayloadLens Demo',
        p_page_is_public_y_n => 'Y');

    wwv_flow_imp.import_end;

    dbms_output.put_line('PAYLOAD_LENS_DEMO_APP_ID=' || l_app_id);
end;
/
show errors

prompt --resolved application id (query, in case dbms_output is not shown):
select application_id, alias, application_name from apex_applications
 where workspace = 'PAYLOADLENS' and alias = 'PAYLOADLENS_DEMO';

prompt --PayloadLens demo application create complete.
