#!/usr/bin/env node
// Keeps the JS/CSS blobs embedded in the shipped APEX export files in sync
// with dist/.
//
// APEX stores plug-in files inside an export as hex chunks
// (wwv_flow_imp.g_varchar2_table(n) := '<hex>';) that create_plugin_file
// turns back into a BLOB on import. This script rewrites exactly those chunk
// lists -- and nothing else -- so a change under src/ only needs
// `npm run build && npm run sync:plugin-files`, never a manual re-export.
// The chunk format (200 hex characters per line, upper case) matches what
// APEX writes itself, so a synced file and a fresh export are byte-identical.
//
//   node scripts/sync-plugin-files.mjs          rewrite the export files in place
//   node scripts/sync-plugin-files.mjs --check  exit 1 if any export is stale (used by CI)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const CHUNK_CHARS = 200;
const checkOnly = process.argv.includes('--check');

const assets = [
  { fileName: 'payload-lens.min.js', dist: join(root, 'dist', 'payload-lens.min.js') },
  { fileName: 'payload-lens.min.css', dist: join(root, 'dist', 'payload-lens.min.css') }
];

const targets = [
  join(root, 'plugin', 'region_type_plugin_b2devtech_payload_lens.sql'),
  join(root, 'demo', 'payloadlens_demo_app.sql')
];

function chunkLines(buf) {
  const hex = buf.toString('hex').toUpperCase();
  const lines = [];
  for (let i = 0, n = 1; i < hex.length; i += CHUNK_CHARS, n++) {
    lines.push(`wwv_flow_imp.g_varchar2_table(${n}) := '${hex.slice(i, i + CHUNK_CHARS)}';`);
  }
  return lines.join('\n') + '\n';
}

// Backslash-escapes regex metacharacters (char 92 is the backslash).
function escapeRegExp(s) {
  return s.replace(/[-[\]{}()*+?.,^$|#\s]/g, (ch) => String.fromCharCode(92) + ch);
}

// Matches one "hex table + create_plugin_file" pair for a given file name.
// Group 1: the block opener, group 2: the chunk lines to replace, group 3: the
// closing lines up to and including the p_file_name that identifies the asset.
// The inner line loop stops at "end;" so a block can never be associated with
// the p_file_name of the *next* create_plugin_file call.
function blockPattern(fileName) {
  return new RegExp(
    String.raw`(begin\nwwv_flow_imp\.g_varchar2_table := wwv_flow_imp\.empty_varchar2_table;\n)` +
    String.raw`((?:wwv_flow_imp\.g_varchar2_table\(\d+\) := '[0-9A-Fa-f]*';\n)+)` +
    String.raw`(null;\nend;\n/\nbegin\nwwv_flow_imp_shared\.create_plugin_file\(\n(?:(?!end;)[^\n]*\n)*?,p_file_name=>'${escapeRegExp(fileName)}'\n)`,
    'g'
  );
}

let stale = 0;
let failed = 0;

for (const target of targets) {
  const rel = relative(root, target).split(sep).join('/');
  const original = readFileSync(target, 'utf8');
  const crlf = original.includes('\r\n');
  let text = original.replace(/\r\n/g, '\n');

  for (const asset of assets) {
    const chunks = chunkLines(readFileSync(asset.dist));
    const pattern = blockPattern(asset.fileName);
    const matches = text.match(pattern) || [];
    if (matches.length !== 1) {
      console.error(`${rel}: expected exactly one embedded copy of ${asset.fileName}, found ${matches.length}`);
      failed++;
      continue;
    }
    text = text.replace(pattern, (_m, open, _oldChunks, close) => open + chunks + close);
  }

  const updated = crlf ? text.replace(/\n/g, '\r\n') : text;
  if (updated === original) {
    console.log(`${rel}: in sync with dist/`);
  } else if (checkOnly) {
    console.error(`${rel}: embedded plug-in files are STALE -- run \`npm run build && npm run sync:plugin-files\``);
    stale++;
  } else {
    writeFileSync(target, updated, 'utf8');
    console.log(`${rel}: embedded plug-in files updated from dist/`);
  }
}

if (failed > 0 || stale > 0) {
  process.exit(1);
}
