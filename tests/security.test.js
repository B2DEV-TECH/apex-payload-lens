import { describe, it, expect, afterEach } from 'vitest';
import payloadLens from '../src/js/payload-lens.js';

const { buildTreeModel, tokenize } = payloadLens._internal;

// The two XSS payloads mandated by the project spec. PayloadLens must
// render these as inert text in both the tree view and the code view —
// never as live DOM (no <script> execution, no onerror-triggering markup).
const XSS_IMG = '<img src=x onerror=alert(1)>';
const XSS_SCRIPT = '<script>alert(1)</script>';

function mount(id) {
  document.body.innerHTML = `<div id="${id}_pl"></div>`;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('XSS safety — rendered output is always inert text, never live markup', () => {
  it.each([
    ['<img>/onerror payload', XSS_IMG],
    ['<script> payload', XSS_SCRIPT]
  ])('renders the %s as inert text in the default tree view', (_label, payload) => {
    mount('XSS_TREE');
    payloadLens.init({ staticId: 'XSS_TREE', staticJson: JSON.stringify({ note: payload }) });

    const root = document.getElementById('XSS_TREE_pl');
    expect(root.querySelectorAll('script').length).toBe(0);
    expect(root.querySelectorAll('[onerror]').length).toBe(0);
    expect(root.querySelectorAll('img').length).toBe(0);
    // The dangerous text must still be present, but only as inert textContent.
    expect(root.textContent).toContain(payload);

    payloadLens.destroy('XSS_TREE');
  });

  it.each([
    ['<img>/onerror payload', XSS_IMG],
    ['<script> payload', XSS_SCRIPT]
  ])('renders the %s as inert text in the code view', (_label, payload) => {
    mount('XSS_CODE');
    const instance = payloadLens.init({
      staticId: 'XSS_CODE',
      staticJson: JSON.stringify({ note: payload }),
      displayMode: 'code'
    });
    expect(instance.displayMode).toBe('code');

    const root = document.getElementById('XSS_CODE_pl');
    expect(root.querySelectorAll('script').length).toBe(0);
    expect(root.querySelectorAll('[onerror]').length).toBe(0);
    expect(root.querySelectorAll('img').length).toBe(0);
    expect(root.textContent).toContain(payload);

    payloadLens.destroy('XSS_CODE');
  });

  it('renders a malicious key name (not just a malicious value) as inert text', () => {
    mount('XSS_KEY');
    const evilKey = '<img src=x onerror=alert(1)>';
    const payload = {};
    payload[evilKey] = 'value';
    payloadLens.init({ staticId: 'XSS_KEY', staticJson: JSON.stringify(payload) });

    const root = document.getElementById('XSS_KEY_pl');
    expect(root.querySelectorAll('script').length).toBe(0);
    expect(root.querySelectorAll('[onerror]').length).toBe(0);
    expect(root.textContent).toContain(evilKey);

    payloadLens.destroy('XSS_KEY');
  });

  it('renders an invalid-JSON error message containing markup as inert text', () => {
    mount('XSS_ERR');
    // The raw text below is not valid JSON, so it takes the error path;
    // it must still never be interpreted as markup anywhere in the DOM.
    payloadLens.init({ staticId: 'XSS_ERR', staticJson: `{"note": ${XSS_SCRIPT}` });

    const root = document.getElementById('XSS_ERR_pl');
    expect(root.querySelectorAll('script').length).toBe(0);
    expect(root.querySelectorAll('[onerror]').length).toBe(0);

    payloadLens.destroy('XSS_ERR');
  });
});

describe('buildTreeModel / tokenize — pure data, never HTML strings', () => {
  it('buildTreeModel returns a plain object tree, not an HTML string or DOM node', () => {
    const model = buildTreeModel({ a: [1, 2] });
    expect(typeof model).toBe('object');
    expect(model).not.toBeNull();
    expect(typeof model.nodeType).toBe('undefined'); // not a DOM node
    expect(model.path).toBe('$');
    expect(model.depth).toBe(0);
    expect(Array.isArray(model.children)).toBe(true);
  });

  it('buildTreeModel never embeds raw HTML markup in its data even for dangerous values', () => {
    const model = buildTreeModel({ note: XSS_SCRIPT });
    const childNode = model.children.find((c) => c.key === 'note');
    expect(childNode.value).toBe(XSS_SCRIPT); // stored verbatim as data, not parsed as markup
    expect(typeof childNode).toBe('object');
  });

  it('tokenize returns a flat array of plain {type, text} tokens, never HTML', () => {
    const tokens = tokenize({ note: XSS_SCRIPT });
    expect(Array.isArray(tokens)).toBe(true);
    tokens.forEach((token) => {
      expect(typeof token).toBe('object');
      expect(typeof token.type).toBe('string');
      expect(typeof token.text).toBe('string');
    });
    // The dangerous text appears as a plain string token, not as markup.
    const joined = tokens.map((t) => t.text).join('');
    expect(joined).toContain(XSS_SCRIPT);
  });
});
