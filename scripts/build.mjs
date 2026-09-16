#!/usr/bin/env node
/*
 * Build script for PayloadLens for Oracle APEX.
 * Minifies src/js/payload-lens.js -> dist/payload-lens.min.js
 * and src/css/payload-lens.css -> dist/payload-lens.min.css.
 * No bundling is needed: the plugin ships as a single dependency-free
 * UMD file plus a single CSS file.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, 'dist');
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/js/payload-lens.js')],
  outfile: path.join(distDir, 'payload-lens.min.js'),
  bundle: false,
  minify: true,
  target: ['es2018'],
  legalComments: 'none'
});

await build({
  entryPoints: [path.join(root, 'src/css/payload-lens.css')],
  outfile: path.join(distDir, 'payload-lens.min.css'),
  bundle: false,
  minify: true,
  legalComments: 'none'
});

console.log('Build complete: dist/payload-lens.min.js, dist/payload-lens.min.css');
