set define off
set verify off
prompt --application/create_plugin/payload_lens_pkg
--------------------------------------------------------------------------------
-- PayloadLens for Oracle APEX -- render package
-- https://github.com/B2DEV-TECH/apex-payload-lens
-- Copyright (c) B2DEV TECH. Released under the MIT License.
--
-- Renders the region markup/JSON config for the payload_lens_pkg.render
-- plug-in render function and registers the plug-in's static JS/CSS files.
-- Uses only documented public runtime APIs (apex_plugin, apex_json,
-- apex_css, apex_javascript, apex_escape, apex_plugin_util) -- see
-- docs/architecture.md for the full design rationale.
--------------------------------------------------------------------------------

create or replace package payload_lens_pkg authid definer as

    function render (
        p_region              in apex_plugin.t_region,
        p_plugin              in apex_plugin.t_plugin,
        p_is_printer_friendly in boolean
    ) return apex_plugin.t_region_render_result;

end payload_lens_pkg;
/
show errors

create or replace package body payload_lens_pkg as

    c_source_static constant varchar2(30) := 'STATIC';
    c_source_item   constant varchar2(30) := 'ITEM';
    c_source_plsql  constant varchar2(30) := 'PLSQL_FUNCTION_BODY';

    -- htp.p has no CLOB overload in this environment; chunk below the
    -- VARCHAR2(32767) limit with headroom for AL32UTF8 4-byte expansion.
    c_htp_chunk_chars constant pls_integer := 8000;

    --------------------------------------------------------------------------
    procedure print_clob (
        p_clob in clob
    ) is
        l_len   pls_integer;
        l_pos   pls_integer := 1;
    begin
        if p_clob is null then
            return;
        end if;
        l_len := dbms_lob.getlength(p_clob);
        while l_pos <= l_len loop
            htp.p(dbms_lob.substr(p_clob, c_htp_chunk_chars, l_pos));
            l_pos := l_pos + c_htp_chunk_chars;
        end loop;
    end print_clob;

    --------------------------------------------------------------------------
    -- Executes an "PL/SQL Function Body" style attribute (a fragment ending
    -- in a RETURN statement) and returns whatever it returns as text.
    -- On failure, returns a plain-text diagnostic instead of raising: the
    -- JS engine's existing "invalid JSON" state then surfaces the error to
    -- the page instead of breaking the whole region.
    --------------------------------------------------------------------------
    function exec_plsql_source (
        p_code in varchar2
    ) return clob is
        l_code   varchar2(32767);
        l_stmt   varchar2(32767);
        l_result clob;
    begin
        if p_code is null then
            return null;
        end if;
        l_code := apex_plugin_util.replace_substitutions(p_value => p_code, p_escape => false);
        l_stmt :=
            'declare' || chr(10) ||
            '    function payload_lens_source_fn return clob is' || chr(10) ||
            '    begin' || chr(10) ||
            l_code || chr(10) ||
            '    end payload_lens_source_fn;' || chr(10) ||
            'begin' || chr(10) ||
            '    :the_result := payload_lens_source_fn;' || chr(10) ||
            'end;';
        execute immediate l_stmt using out l_result;
        return l_result;
    exception
        when others then
            return 'PayloadLens: error evaluating the PL/SQL Source attribute -- ' || sqlerrm;
    end exec_plsql_source;

    --------------------------------------------------------------------------
    -- Splits a comma-separated attribute value into trimmed, non-empty
    -- tokens and writes them as a JSON string array under p_name.
    --------------------------------------------------------------------------
    procedure write_csv_array (
        p_name  in varchar2,
        p_value in varchar2
    ) is
        l_value    varchar2(32767) := p_value || ',';
        l_pos      pls_integer;
        l_token    varchar2(32767);
        l_start    pls_integer := 1;
    begin
        apex_json.open_array(p_name);
        loop
            l_pos := instr(l_value, ',', l_start);
            exit when l_pos = 0;
            l_token := trim(substr(l_value, l_start, l_pos - l_start));
            if l_token is not null then
                apex_json.write(l_token);
            end if;
            l_start := l_pos + 1;
        end loop;
        apex_json.close_array;
    end write_csv_array;

    --------------------------------------------------------------------------
    function render (
        p_region              in apex_plugin.t_region,
        p_plugin              in apex_plugin.t_plugin,
        p_is_printer_friendly in boolean
    ) return apex_plugin.t_region_render_result is

        l_result        apex_plugin.t_region_render_result;

        -- dom_id (not static_id) is guaranteed populated even when the
        -- developer leaves the region's Static ID blank, and is not
        -- deprecated as of 26.1 -- see docs/architecture.md.
        l_dom_id        varchar2(255) := p_region.dom_id;
        l_mount_id      varchar2(261) := l_dom_id || '_pl';
        l_data_id       varchar2(266) := l_dom_id || '_pl_data';

        l_source_type   varchar2(30)  := nvl(upper(p_region.attribute_01), c_source_static);
        l_display_mode  varchar2(10)  := case when lower(p_region.attribute_05) = 'code' then 'code' else 'tree' end;

        l_payload_clob  clob;
        l_config_clob   clob;
    begin
        if p_is_printer_friendly then
            l_result.is_navigable := false;
            return l_result;
        end if;

        if l_source_type = c_source_plsql then
            l_payload_clob := exec_plsql_source(p_region.attribute_04);
        elsif l_source_type != c_source_item then
            l_payload_clob := apex_plugin_util.replace_substitutions(
                                   p_value  => p_region.attribute_02,
                                   p_escape => false );
        end if;

        apex_json.initialize_output(p_indent => 0);
        apex_json.open_object;

        apex_json.write('staticId', l_dom_id);

        if l_source_type = c_source_item then
            apex_json.write('sourceType', c_source_item);
            apex_json.write('itemName', p_region.attribute_03);
        else
            -- PLSQL_FUNCTION_BODY is resolved above and always shipped to
            -- the client as a plain static payload; the JS engine only
            -- knows about STATIC and ITEM sources.
            apex_json.write('sourceType', c_source_static);
            apex_json.write('staticJson', l_payload_clob);
        end if;

        apex_json.write('displayMode', l_display_mode);
        apex_json.write('initialExpandDepth', nvl(p_region.attribute_06, '2'));
        apex_json.write('enableSearch', nvl(upper(p_region.attribute_07), 'Y') = 'Y');
        apex_json.write('enableCopy', nvl(upper(p_region.attribute_08), 'Y') = 'Y');
        apex_json.write('enableMetadata', nvl(upper(p_region.attribute_09), 'Y') = 'Y');
        apex_json.write('enableMasking', nvl(upper(p_region.attribute_10), 'Y') = 'Y');

        if p_region.attribute_11 is not null then
            write_csv_array('sensitiveKeys', p_region.attribute_11);
        end if;

        apex_json.write('caseSensitiveMasking', nvl(upper(p_region.attribute_12), 'N') = 'Y');
        apex_json.write('maskChar', nvl(p_region.attribute_13, '*'));
        apex_json.write('maxDisplayBytes', to_number(nvl(p_region.attribute_14, '1048576')));

        apex_json.close_object;
        l_config_clob := apex_json.get_clob_output;
        apex_json.free_output;

        -- Neutralize a "</script" break-out of the JSON <script> block below.
        -- "\/" is a legal JSON escape for "/", so this round-trips through
        -- JSON.parse() unchanged.
        l_config_clob := replace(l_config_clob, '</', '<\/');

        apex_css.add_file(
            p_name      => 'payload-lens.min',
            p_directory => p_plugin.file_prefix );

        apex_javascript.add_library(
            p_name           => 'payload-lens.min',
            p_directory      => p_plugin.file_prefix,
            p_skip_extension => false );

        htp.p('<div id="' || apex_escape.html(l_mount_id) || '" class="payload-lens"></div>');
        htp.p('<script type="application/json" id="' || apex_escape.html(l_data_id) || '">');
        print_clob(l_config_clob);
        htp.p('</script>');

        -- l_data_id is derived only from the framework-generated dom_id
        -- (never free text), so it is safe to inline as a JS string literal.
        apex_javascript.add_onload_code(
            p_code => '(function(){var d=document.getElementById(''' || l_data_id || ''');' ||
                      'var c=d?JSON.parse(d.textContent):null;' ||
                      'if(c&&window.payloadLens){window.payloadLens.init(c);}})();' );

        l_result.is_navigable := false;
        return l_result;
    end render;

end payload_lens_pkg;
/
show errors
