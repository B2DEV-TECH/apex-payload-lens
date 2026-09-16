/*!
 * PayloadLens for Oracle APEX
 * https://github.com/B2DEV-TECH/apex-payload-lens
 *
 * An independent open-source plugin for Oracle APEX.
 * Not affiliated with, endorsed by, or a product of Oracle Corporation.
 *
 * Copyright (c) B2DEV TECH. Released under the MIT License.
 *
 * -------------------------------------------------------------------------
 * SECURITY NOTE FOR REVIEWERS
 * -------------------------------------------------------------------------
 * Payload content is treated as UNTRUSTED throughout this file. Every piece
 * of text that originates from a payload (keys, string values, numbers,
 * error details) is written to the DOM through `textContent` or
 * `document.createTextNode` only. This file never assigns payload-derived
 * text to `innerHTML`, never calls `eval`, and never calls `Function(...)`.
 * See tests/security.test.js for behavioral proof against common XSS
 * payloads, and docs/security.md for the full statement.
 * -------------------------------------------------------------------------
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    // Node / test environment (CommonJS) — used by the vitest suite.
    module.exports = factory();
  } else {
    // Browser environment inside an APEX page.
    root.payloadLens = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ===========================================================================
  // Constants
  // ===========================================================================

  var DEFAULT_SENSITIVE_KEYS = [
    'password', 'passwd', 'token', 'access_token', 'refresh_token',
    'authorization', 'apikey', 'api_key', 'secret', 'accountnumber',
    'bankaccount', 'routingnumber', 'email', 'taxid'
  ];

  var DEFAULT_MASK_CHAR = '*';
  var MIN_MASK_LENGTH = 3;
  var MAX_MASK_LENGTH = 32;

  // Hard ceiling applied even when the developer sets "Max Display Bytes"
  // higher than this. Protects the browser tab from a runaway render if a
  // page item unexpectedly holds many megabytes of text.
  var HARD_MAX_DISPLAY_BYTES = 5 * 1024 * 1024; // 5 MB

  var DEFAULT_MAX_DISPLAY_BYTES = 1 * 1024 * 1024; // 1 MB, matches the documented target range

  var VIEW_TREE = 'tree';
  var VIEW_CODE = 'code';

  // ===========================================================================
  // Small DOM helpers (no innerHTML, ever)
  // ===========================================================================

  /**
   * Create an element without ever touching innerHTML.
   * @param {string} tag
   * @param {Object} [attrs] - plain attributes; `class` and `text` are special-cased.
   * @param {Array} [children] - array of Node | string (strings become text nodes).
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) {
          return;
        }
        if (key === 'class') {
          node.className = value;
        } else if (key === 'text') {
          node.appendChild(document.createTextNode(String(value)));
        } else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          node.setAttribute(key, value === true ? '' : String(value));
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (child === null || child === undefined) {
          return;
        }
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      });
    }
    return node;
  }

  function clearElement(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  // ===========================================================================
  // parsePayload — turns a raw value (string, object, null, undefined) into a
  // normalized descriptor. Never throws.
  // ===========================================================================

  /**
   * @param {*} raw - a JSON string, an already-parsed object/array, null, or undefined.
   * @returns {{status:'ok'|'empty'|'error', emptyKind?:string, value?:*, error?:{message:string}}}
   */
  function parsePayload(raw) {
    if (raw === undefined) {
      return { status: 'empty', emptyKind: 'undefined' };
    }
    if (raw === null) {
      return { status: 'empty', emptyKind: 'null' };
    }
    if (typeof raw !== 'string') {
      // Already a parsed JS value (common when the developer builds it
      // programmatically before calling payloadLens.setPayload()).
      return classifyValue(raw);
    }

    var trimmed = raw.trim();
    if (trimmed === '') {
      return { status: 'empty', emptyKind: 'empty-string' };
    }

    try {
      var value = JSON.parse(trimmed);
      return classifyValue(value);
    } catch (err) {
      return {
        status: 'error',
        error: {
          // err.message from JSON.parse never contains the payload's own
          // sensitive values — only "Unexpected token X in JSON at
          // position N" style text — so it is safe to surface as-is.
          message: 'Invalid JSON payload',
          detail: err && err.message ? String(err.message) : ''
        }
      };
    }
  }

  function classifyValue(value) {
    if (value === null) {
      return { status: 'empty', emptyKind: 'null' };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { status: 'empty', emptyKind: 'empty-array', value: value };
    }
    if (isPlainObject(value) && Object.keys(value).length === 0) {
      return { status: 'empty', emptyKind: 'empty-object', value: value };
    }
    return { status: 'ok', value: value };
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  // ===========================================================================
  // maskPayload — pure, independently unit-testable masking logic.
  // Runs BEFORE anything reaches the DOM, the search index, or the clipboard.
  // ===========================================================================

  /**
   * @param {*} value - already-parsed JSON value.
   * @param {Object} [options]
   * @param {string[]} [options.sensitiveKeys]
   * @param {boolean}  [options.caseSensitive=false]
   * @param {string}   [options.maskChar='*']
   * @param {boolean}  [options.enabled=true]
   * @returns {*} a deep copy with sensitive leaves replaced; the input is never mutated.
   */
  function maskPayload(value, options) {
    var opts = options || {};
    if (opts.enabled === false) {
      return deepClone(value);
    }
    var keySet = buildSensitiveKeySet(opts.sensitiveKeys || DEFAULT_SENSITIVE_KEYS, !!opts.caseSensitive);
    var maskChar = (opts.maskChar || DEFAULT_MASK_CHAR).charAt(0) || DEFAULT_MASK_CHAR;
    return maskNode(value, keySet, !!opts.caseSensitive, maskChar, false);
  }

  function buildSensitiveKeySet(list, caseSensitive) {
    var set = Object.create(null);
    (list || []).forEach(function (rawKey) {
      var key = String(rawKey || '').trim();
      if (!key) {
        return;
      }
      set[caseSensitive ? key : key.toLowerCase()] = true;
    });
    return set;
  }

  function isSensitiveKey(key, keySet, caseSensitive) {
    var normalized = caseSensitive ? key : String(key).toLowerCase();
    return Object.prototype.hasOwnProperty.call(keySet, normalized);
  }

  function maskNode(node, keySet, caseSensitive, maskChar, parentIsSensitive) {
    if (Array.isArray(node)) {
      return node.map(function (item) {
        return parentIsSensitive
          ? maskLeaf(item, maskChar)
          : maskNode(item, keySet, caseSensitive, maskChar, false);
      });
    }
    if (isPlainObject(node)) {
      if (parentIsSensitive) {
        // A sensitive key held a nested object/array (e.g. "token": {...}).
        // Redact the whole subtree rather than trying to decide which of
        // its descendants are "sensitive enough" — the key itself already
        // told us the developer does not want this shown.
        return maskLeaf(node, maskChar);
      }
      var out = {};
      Object.keys(node).forEach(function (key) {
        var childIsSensitive = isSensitiveKey(key, keySet, caseSensitive);
        out[key] = maskNode(node[key], keySet, caseSensitive, maskChar, childIsSensitive);
      });
      return out;
    }
    return parentIsSensitive ? maskLeaf(node, maskChar) : node;
  }

  function maskLeaf(value, maskChar) {
    if (value === null || value === undefined) {
      return value;
    }
    var asString = typeof value === 'object' ? safeStringify(value) : String(value);
    var length = Math.min(Math.max(asString.length, MIN_MASK_LENGTH), MAX_MASK_LENGTH);
    return repeatChar(maskChar, length);
  }

  function repeatChar(ch, count) {
    if (typeof ''.repeat === 'function') {
      return ch.repeat(count);
    }
    var out = '';
    for (var i = 0; i < count; i++) {
      out += ch;
    }
    return out;
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[unserializable]';
    }
  }

  function deepClone(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(deepClone);
    }
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = deepClone(value[key]);
    });
    return out;
  }

  // ===========================================================================
  // calculateMetadata — structural counts only. Computed from the ORIGINAL
  // parsed value (never from raw sensitive strings) because only the shape
  // of the payload is reported, never any value content.
  // ===========================================================================

  function calculateMetadata(value) {
    var stats = { propertyCount: 0, arrayElementCount: 0, maxDepth: 0 };
    walkForMetadata(value, 0, stats);
    return {
      sizeBytes: byteLength(safeStringify(value === undefined ? null : value)),
      propertyCount: stats.propertyCount,
      arrayElementCount: stats.arrayElementCount,
      maxDepth: stats.maxDepth
    };
  }

  function walkForMetadata(node, depth, stats) {
    if (depth > stats.maxDepth) {
      stats.maxDepth = depth;
    }
    if (Array.isArray(node)) {
      stats.arrayElementCount += node.length;
      node.forEach(function (item) {
        walkForMetadata(item, depth + 1, stats);
      });
    } else if (isPlainObject(node)) {
      var keys = Object.keys(node);
      stats.propertyCount += keys.length;
      keys.forEach(function (key) {
        walkForMetadata(node[key], depth + 1, stats);
      });
    }
  }

  function byteLength(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    // Reasonable fallback for environments without TextEncoder: count each
    // UTF-16 code unit outside the BMP as part of a surrogate pair (already
    // 2 JS chars) and everything else as 1-3 UTF-8 bytes approximated via
    // encodeURIComponent, which is accurate for BMP characters.
    return unescape(encodeURIComponent(str)).length;
  }

  // ===========================================================================
  // Tree model — a plain-object representation, independent of the DOM, so it
  // can be unit tested and re-rendered without re-walking the source value.
  // ===========================================================================

  function buildTreeModel(value) {
    return buildNode('$', null, value, 0);
  }

  function buildNode(path, key, value, depth) {
    var node = { path: path, key: key, depth: depth };
    if (Array.isArray(value)) {
      node.type = 'array';
      node.children = value.map(function (item, index) {
        return buildNode(path + '[' + index + ']', '[' + index + ']', item, depth + 1);
      });
    } else if (isPlainObject(value)) {
      node.type = 'object';
      node.children = Object.keys(value).map(function (childKey) {
        return buildNode(path + '.' + childKey, childKey, value[childKey], depth + 1);
      });
    } else {
      node.type = valueType(value);
      node.value = value;
    }
    return node;
  }

  function valueType(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  // ===========================================================================
  // Code view tokenizer — emits a flat token stream so renderCode() can build
  // the DOM without ever re-parsing a string of HTML.
  // ===========================================================================

  function tokenize(value) {
    var tokens = [];
    tokenizeNode(value, 0, tokens, false);
    return tokens;
  }

  function push(tokens, type, text) {
    tokens.push({ type: type, text: text });
  }

  function indent(depth) {
    var pad = '';
    for (var i = 0; i < depth; i++) {
      pad += '  ';
    }
    return pad;
  }

  function tokenizeNode(value, depth, tokens, isLast) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        push(tokens, 'punctuation', '[]');
      } else {
        push(tokens, 'punctuation', '[\n');
        value.forEach(function (item, index) {
          push(tokens, 'whitespace', indent(depth + 1));
          tokenizeNode(item, depth + 1, tokens, index === value.length - 1);
          push(tokens, 'punctuation', index === value.length - 1 ? '\n' : ',\n');
        });
        push(tokens, 'whitespace', indent(depth));
        push(tokens, 'punctuation', ']');
      }
    } else if (isPlainObject(value)) {
      var keys = Object.keys(value);
      if (keys.length === 0) {
        push(tokens, 'punctuation', '{}');
      } else {
        push(tokens, 'punctuation', '{\n');
        keys.forEach(function (key, index) {
          push(tokens, 'whitespace', indent(depth + 1));
          push(tokens, 'key', JSON.stringify(key));
          push(tokens, 'punctuation', ': ');
          tokenizeNode(value[key], depth + 1, tokens, index === keys.length - 1);
          push(tokens, 'punctuation', index === keys.length - 1 ? '\n' : ',\n');
        });
        push(tokens, 'whitespace', indent(depth));
        push(tokens, 'punctuation', '}');
      }
    } else if (value === null) {
      push(tokens, 'null', 'null');
    } else if (typeof value === 'boolean') {
      push(tokens, 'boolean', String(value));
    } else if (typeof value === 'number') {
      push(tokens, 'number', String(value));
    } else {
      push(tokens, 'string', JSON.stringify(String(value)));
    }
  }

  // ===========================================================================
  // Instance registry — every region gets its own entry, keyed by static id,
  // so two PayloadLens regions on the same page never share state or DOM.
  // ===========================================================================

  var instances = Object.create(null);

  function createInstance(config) {
    return {
      staticId: config.staticId,
      root: config.root,
      sourceType: config.sourceType || 'STATIC',
      itemName: config.itemName || null,
      staticJson: config.staticJson,
      displayMode: config.displayMode === VIEW_CODE ? VIEW_CODE : VIEW_TREE,
      initialExpandDepth: normalizeDepth(config.initialExpandDepth),
      enableSearch: config.enableSearch !== false,
      enableCopy: config.enableCopy !== false,
      enableMetadata: config.enableMetadata !== false,
      maskingOptions: {
        enabled: config.enableMasking !== false,
        sensitiveKeys: config.sensitiveKeys || DEFAULT_SENSITIVE_KEYS,
        caseSensitive: !!config.caseSensitiveMasking,
        maskChar: config.maskChar || DEFAULT_MASK_CHAR
      },
      maxDisplayBytes: clampMaxDisplayBytes(config.maxDisplayBytes),
      // Mutable render state, reset on every render:
      maskedValue: undefined,
      treeModel: null,
      searchIndex: [],
      searchMatches: [],
      searchCursor: -1,
      expanded: Object.create(null), // path -> boolean
      elements: {} // populated by buildChrome()
    };
  }

  function normalizeDepth(value) {
    if (value === 'ALL' || value === -1) {
      return -1;
    }
    var n = parseInt(value, 10);
    return isNaN(n) || n < 0 ? 1 : n;
  }

  function clampMaxDisplayBytes(value) {
    var n = parseInt(value, 10);
    if (isNaN(n) || n <= 0) {
      n = DEFAULT_MAX_DISPLAY_BYTES;
    }
    return Math.min(n, HARD_MAX_DISPLAY_BYTES);
  }

  // ===========================================================================
  // Chrome (toolbar) construction
  // ===========================================================================

  function buildChrome(instance) {
    var root = instance.root;
    clearElement(root);
    root.classList.add('payload-lens');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'PayloadLens payload viewer');

    var toolbar = el('div', { class: 'payload-lens__toolbar', role: 'toolbar', 'aria-label': 'PayloadLens controls' });

    var viewGroup = el('div', { class: 'payload-lens__view-switch' });
    var treeBtn = el('button', {
      type: 'button',
      class: 'payload-lens__btn payload-lens__btn--view',
      'aria-pressed': instance.displayMode === VIEW_TREE,
      text: 'Tree',
      onclick: function () { setView(instance, VIEW_TREE); }
    });
    var codeBtn = el('button', {
      type: 'button',
      class: 'payload-lens__btn payload-lens__btn--view',
      'aria-pressed': instance.displayMode === VIEW_CODE,
      text: 'Code',
      onclick: function () { setView(instance, VIEW_CODE); }
    });
    viewGroup.appendChild(treeBtn);
    viewGroup.appendChild(codeBtn);
    toolbar.appendChild(viewGroup);
    instance.elements.treeBtn = treeBtn;
    instance.elements.codeBtn = codeBtn;

    if (instance.enableSearch) {
      toolbar.appendChild(buildSearchBar(instance));
    }

    var actions = el('div', { class: 'payload-lens__actions' });
    var expandAllBtn = el('button', {
      type: 'button', class: 'payload-lens__btn', text: 'Expand all',
      onclick: function () { expandAll(instance.staticId); }
    });
    var collapseAllBtn = el('button', {
      type: 'button', class: 'payload-lens__btn', text: 'Collapse all',
      onclick: function () { collapseAll(instance.staticId); }
    });
    actions.appendChild(expandAllBtn);
    actions.appendChild(collapseAllBtn);
    instance.elements.expandAllBtn = expandAllBtn;
    instance.elements.collapseAllBtn = collapseAllBtn;

    if (instance.enableCopy) {
      var copyBtn = el('button', {
        type: 'button', class: 'payload-lens__btn payload-lens__btn--primary', text: 'Copy',
        onclick: function () { copyPayload(instance); }
      });
      actions.appendChild(copyBtn);
      instance.elements.copyBtn = copyBtn;
    }
    toolbar.appendChild(actions);
    root.appendChild(toolbar);

    if (instance.enableMetadata) {
      var meta = el('div', { class: 'payload-lens__meta', 'aria-live': 'polite' });
      root.appendChild(meta);
      instance.elements.meta = meta;
    }

    var status = el('div', { class: 'payload-lens__status', role: 'status', 'aria-live': 'polite' });
    root.appendChild(status);
    instance.elements.status = status;

    var viewport = el('div', { class: 'payload-lens__viewport' });
    root.appendChild(viewport);
    instance.elements.viewport = viewport;

    updateViewButtons(instance);
  }

  function buildSearchBar(instance) {
    var wrap = el('div', { class: 'payload-lens__search' });
    var input = el('input', {
      type: 'text',
      class: 'payload-lens__search-input',
      placeholder: 'Search keys and values…',
      'aria-label': 'Search payload'
    });
    input.addEventListener('input', function () {
      runSearch(instance, input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        stepSearch(instance, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        clearSearch(instance);
      }
    });

    var count = el('span', { class: 'payload-lens__search-count', 'aria-live': 'polite', text: '' });
    var prevBtn = el('button', {
      type: 'button', class: 'payload-lens__btn payload-lens__btn--icon', text: '↑',
      'aria-label': 'Previous match',
      onclick: function () { stepSearch(instance, -1); }
    });
    var nextBtn = el('button', {
      type: 'button', class: 'payload-lens__btn payload-lens__btn--icon', text: '↓',
      'aria-label': 'Next match',
      onclick: function () { stepSearch(instance, 1); }
    });
    var clearBtn = el('button', {
      type: 'button', class: 'payload-lens__btn payload-lens__btn--icon', text: '×',
      'aria-label': 'Clear search',
      onclick: function () { input.value = ''; clearSearch(instance); }
    });

    wrap.appendChild(input);
    wrap.appendChild(count);
    wrap.appendChild(prevBtn);
    wrap.appendChild(nextBtn);
    wrap.appendChild(clearBtn);

    instance.elements.searchInput = input;
    instance.elements.searchCount = count;
    return wrap;
  }

  function updateViewButtons(instance) {
    instance.elements.treeBtn.setAttribute('aria-pressed', String(instance.displayMode === VIEW_TREE));
    instance.elements.codeBtn.setAttribute('aria-pressed', String(instance.displayMode === VIEW_CODE));
    instance.elements.treeBtn.classList.toggle('is-active', instance.displayMode === VIEW_TREE);
    instance.elements.codeBtn.classList.toggle('is-active', instance.displayMode === VIEW_CODE);
  }

  function setView(instance, view) {
    if (instance.displayMode === view) {
      return;
    }
    instance.displayMode = view;
    updateViewButtons(instance);
    renderActiveView(instance);
  }

  // ===========================================================================
  // Rendering the payload (tree or code) into the viewport
  // ===========================================================================

  function renderPayload(instance, parsed) {
    setStatus(instance, '');
    clearElement(instance.elements.viewport);

    if (parsed.status === 'error') {
      renderErrorState(instance, parsed.error);
      if (instance.elements.meta) clearElement(instance.elements.meta);
      return;
    }
    if (parsed.status === 'empty') {
      renderEmptyState(instance, parsed.emptyKind);
      if (instance.elements.meta) clearElement(instance.elements.meta);
      return;
    }

    var rawSize = byteLength(safeStringify(parsed.value));
    if (rawSize > instance.maxDisplayBytes) {
      renderTooLargeState(instance, rawSize);
      if (instance.elements.meta) clearElement(instance.elements.meta);
      return;
    }

    instance.maskedValue = maskPayload(parsed.value, instance.maskingOptions);
    instance.treeModel = buildTreeModel(instance.maskedValue);
    instance.expanded = Object.create(null);
    seedExpandedState(instance.treeModel, instance);

    if (instance.enableMetadata) {
      renderMetadata(instance, calculateMetadata(parsed.value));
    }

    renderActiveView(instance);
  }

  function seedExpandedState(node, instance) {
    if (node.type !== 'object' && node.type !== 'array') {
      return;
    }
    var withinDepth = instance.initialExpandDepth === -1 || node.depth < instance.initialExpandDepth;
    instance.expanded[node.path] = withinDepth;
    (node.children || []).forEach(function (child) {
      seedExpandedState(child, instance);
    });
  }

  function renderActiveView(instance) {
    if (!instance.treeModel) {
      return;
    }
    clearElement(instance.elements.viewport);
    if (instance.displayMode === VIEW_CODE) {
      var tokens = tokenize(instance.maskedValue);
      var pre = renderCode(tokens);
      instance.elements.viewport.appendChild(pre);
      instance.searchIndex = buildCodeSearchIndex(pre);
    } else {
      var treeRoot = renderTree(instance.treeModel, instance);
      instance.elements.viewport.appendChild(treeRoot);
      instance.searchIndex = buildTreeSearchIndex(instance.treeModel, instance);
    }
    if (instance.elements.searchInput && instance.elements.searchInput.value) {
      runSearch(instance, instance.elements.searchInput.value);
    }
  }

  function renderErrorState(instance, error) {
    var box = el('div', { class: 'payload-lens__error', role: 'alert' }, [
      el('p', { class: 'payload-lens__error-title', text: error.message }),
      error.detail ? el('p', { class: 'payload-lens__error-detail', text: error.detail }) : null
    ]);
    instance.elements.viewport.appendChild(box);
  }

  function renderEmptyState(instance, kind) {
    var messages = {
      'null': 'Payload is null.',
      'undefined': 'No payload was supplied.',
      'empty-string': 'Payload is an empty string.',
      'empty-object': 'Payload is an empty object ({}).',
      'empty-array': 'Payload is an empty array ([]).'
    };
    var box = el('div', { class: 'payload-lens__empty' }, [
      el('p', { text: messages[kind] || 'Nothing to display.' })
    ]);
    instance.elements.viewport.appendChild(box);
  }

  function renderTooLargeState(instance, sizeBytes) {
    var box = el('div', { class: 'payload-lens__error', role: 'alert' }, [
      el('p', { class: 'payload-lens__error-title', text: 'Payload too large to render safely.' }),
      el('p', {
        class: 'payload-lens__error-detail',
        text: 'Size is ' + formatBytes(sizeBytes) + ', which exceeds the configured limit of ' +
          formatBytes(instance.maxDisplayBytes) + '. Increase "Max Display Bytes" on the region if you need to inspect it here.'
      })
    ]);
    instance.elements.viewport.appendChild(box);
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function renderMetadata(instance, meta) {
    clearElement(instance.elements.meta);
    var parts = [
      formatBytes(meta.sizeBytes),
      meta.propertyCount + ' propert' + (meta.propertyCount === 1 ? 'y' : 'ies'),
      meta.arrayElementCount + ' array element' + (meta.arrayElementCount === 1 ? '' : 's'),
      'depth ' + meta.maxDepth
    ];
    parts.forEach(function (text, index) {
      if (index > 0) {
        instance.elements.meta.appendChild(document.createTextNode(' · '));
      }
      instance.elements.meta.appendChild(el('span', { class: 'payload-lens__meta-item', text: text }));
    });
  }

  function setStatus(instance, text) {
    instance.elements.status.textContent = text || '';
  }

  // ===========================================================================
  // Tree renderer
  // ===========================================================================

  function renderTree(model, instance) {
    var root = el('ul', { class: 'payload-lens__tree', role: 'tree' });
    root.appendChild(renderTreeNode(model, instance, true));
    return root;
  }

  function renderTreeNode(node, instance, isRoot) {
    var li = el('li', { class: 'payload-lens__node', role: 'treeitem', 'data-path': node.path });
    var isContainer = node.type === 'object' || node.type === 'array';

    var row = el('div', { class: 'payload-lens__node-row' });

    if (isContainer) {
      var expanded = !!instance.expanded[node.path];
      li.setAttribute('aria-expanded', String(expanded));
      var toggle = el('button', {
        type: 'button',
        class: 'payload-lens__toggle',
        'aria-label': (expanded ? 'Collapse' : 'Expand') + ' ' + describeKey(node),
        text: expanded ? '▾' : '▸',
        onclick: function () { toggleNode(instance, node.path); }
      });
      row.appendChild(toggle);
    } else {
      row.appendChild(el('span', { class: 'payload-lens__toggle payload-lens__toggle--spacer' }));
    }

    if (!isRoot && node.key !== null) {
      row.appendChild(el('span', { class: 'payload-lens__key', text: node.key + ':' }));
    }

    if (isContainer) {
      var count = (node.children || []).length;
      var summary = node.type === 'array' ? '[' + count + ']' : '{' + count + '}';
      row.appendChild(el('span', { class: 'payload-lens__summary', text: summary }));
    } else {
      row.appendChild(renderLeafValue(node));
    }

    var pathBtn = el('button', {
      type: 'button', class: 'payload-lens__path-btn', text: 'path',
      'aria-label': 'Copy JSON path for ' + describeKey(node),
      onclick: function () { copyText(jsonPathFor(node.path), instance, 'JSON path copied.'); }
    });
    row.appendChild(pathBtn);

    li.appendChild(row);

    if (isContainer && instance.expanded[node.path]) {
      var childList = el('ul', { class: 'payload-lens__children', role: 'group' });
      (node.children || []).forEach(function (child) {
        childList.appendChild(renderTreeNode(child, instance, false));
      });
      li.appendChild(childList);
    }

    return li;
  }

  function describeKey(node) {
    return node.key === null ? 'root' : String(node.key);
  }

  function jsonPathFor(internalPath) {
    // Internal paths use "$" for the root, ".key" for object members and
    // "[n]" for array elements — already valid JSONPath-ish syntax.
    return internalPath;
  }

  function renderLeafValue(node) {
    var cls = 'payload-lens__' + node.type;
    var text;
    if (node.type === 'string') {
      text = JSON.stringify(node.value);
    } else if (node.type === 'null') {
      text = 'null';
    } else {
      text = String(node.value);
    }
    return el('span', { class: cls, text: text });
  }

  function toggleNode(instance, path) {
    instance.expanded[path] = !instance.expanded[path];
    renderActiveView(instance);
  }

  function setExpandedRecursive(node, expanded, instance) {
    if (node.type === 'object' || node.type === 'array') {
      instance.expanded[node.path] = expanded;
      (node.children || []).forEach(function (child) {
        setExpandedRecursive(child, expanded, instance);
      });
    }
  }

  // ===========================================================================
  // Code renderer
  // ===========================================================================

  function renderCode(tokens) {
    var pre = el('pre', { class: 'payload-lens__code' });
    var code = el('code', {});
    tokens.forEach(function (token) {
      if (token.type === 'whitespace' || token.type === 'punctuation') {
        code.appendChild(document.createTextNode(token.text));
      } else {
        code.appendChild(el('span', { class: 'payload-lens__' + token.type, text: token.text }));
      }
    });
    pre.appendChild(code);
    return pre;
  }

  // ===========================================================================
  // Search — operates only on the already-masked, already-rendered text, so
  // a masked value's original content can never be found by a search term.
  // ===========================================================================

  function buildTreeSearchIndex(model, instance) {
    var index = [];
    (function walk(node) {
      index.push({
        path: node.path,
        text: (node.key !== null ? node.key + ' ' : '') +
          (node.type === 'object' || node.type === 'array' ? '' : String(node.value)),
        reveal: function () { revealTreePath(instance, node.path); },
        getElement: function () {
          return instance.elements.viewport.querySelector('[data-path="' + cssEscape(node.path) + '"] > .payload-lens__node-row');
        }
      });
      (node.children || []).forEach(walk);
    })(model);
    return index;
  }

  function buildCodeSearchIndex(pre) {
    var index = [];
    var spans = pre.querySelectorAll('.payload-lens__key, .payload-lens__string, .payload-lens__number, .payload-lens__boolean, .payload-lens__null');
    spans.forEach(function (span) {
      index.push({
        text: span.textContent,
        reveal: function () {},
        getElement: function () { return span; }
      });
    });
    return index;
  }

  function revealTreePath(instance, path) {
    var segments = splitPath(path);
    var current = '$';
    for (var i = 0; i < segments.length; i++) {
      current += segments[i];
      if (current !== path) {
        instance.expanded[current] = true;
      }
    }
  }

  function splitPath(path) {
    var withoutRoot = path.slice(1); // strip leading "$"
    var matches = withoutRoot.match(/(\.[^.[\]]+|\[\d+\])/g) || [];
    return matches;
  }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) {
      return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, function (ch) {
      return '\\' + ch;
    });
  }

  function runSearch(instance, query) {
    clearHighlights(instance);
    var trimmed = (query || '').trim();
    if (!trimmed) {
      instance.searchMatches = [];
      instance.searchCursor = -1;
      updateSearchCount(instance);
      return;
    }
    var needle = trimmed.toLowerCase();
    instance.searchMatches = instance.searchIndex.filter(function (entry) {
      return entry.text.toLowerCase().indexOf(needle) !== -1;
    });
    instance.searchCursor = instance.searchMatches.length ? 0 : -1;
    updateSearchCount(instance);
    if (instance.searchCursor >= 0) {
      focusMatch(instance);
    }
  }

  function stepSearch(instance, delta) {
    if (!instance.searchMatches.length) {
      return;
    }
    instance.searchCursor = (instance.searchCursor + delta + instance.searchMatches.length) % instance.searchMatches.length;
    focusMatch(instance);
  }

  function clearSearch(instance) {
    instance.searchMatches = [];
    instance.searchCursor = -1;
    clearHighlights(instance);
    updateSearchCount(instance);
  }

  function clearHighlights(instance) {
    var highlighted = instance.elements.viewport.querySelectorAll('.payload-lens__match, .payload-lens__match--current');
    highlighted.forEach(function (elm) {
      elm.classList.remove('payload-lens__match');
      elm.classList.remove('payload-lens__match--current');
    });
  }

  function focusMatch(instance) {
    if (instance.displayMode === VIEW_TREE) {
      instance.searchMatches.forEach(function (entry) {
        entry.reveal();
      });
      renderActiveView(instance);
      // renderActiveView rebuilt the DOM (tree expansion may have changed),
      // so re-run search against the fresh index before highlighting.
      var needle = instance.elements.searchInput.value.trim().toLowerCase();
      instance.searchMatches = instance.searchIndex.filter(function (entry) {
        return entry.text.toLowerCase().indexOf(needle) !== -1;
      });
      if (instance.searchCursor >= instance.searchMatches.length) {
        instance.searchCursor = 0;
      }
    }
    instance.searchMatches.forEach(function (entry, index) {
      var elm = entry.getElement();
      if (!elm) return;
      elm.classList.add('payload-lens__match');
      if (index === instance.searchCursor) {
        elm.classList.add('payload-lens__match--current');
        elm.scrollIntoView({ block: 'nearest' });
      }
    });
    updateSearchCount(instance);
  }

  function updateSearchCount(instance) {
    if (!instance.elements.searchCount) {
      return;
    }
    if (!instance.searchMatches.length) {
      instance.elements.searchCount.textContent = instance.elements.searchInput.value ? '0 matches' : '';
      return;
    }
    instance.elements.searchCount.textContent = (instance.searchCursor + 1) + ' of ' + instance.searchMatches.length;
  }

  // ===========================================================================
  // Copy
  // ===========================================================================

  function copyPayload(instance) {
    if (instance.maskedValue === undefined) {
      copyText('', instance, 'Nothing to copy.');
      return;
    }
    var text = JSON.stringify(instance.maskedValue, null, 2);
    copyText(text, instance, 'Payload copied to clipboard (masked).');
  }

  function copyText(text, instance, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setStatus(instance, successMessage); },
        function () { fallbackCopy(text, instance, successMessage); }
      );
    } else {
      fallbackCopy(text, instance, successMessage);
    }
  }

  function fallbackCopy(text, instance, successMessage) {
    try {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      setStatus(instance, ok ? successMessage : 'Copy failed. Select and copy the text manually.');
    } catch (e) {
      setStatus(instance, 'Copy is not available in this browser.');
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  function resolveInitialValue(instance) {
    if (instance.sourceType === 'ITEM' && instance.itemName) {
      return readItemValue(instance.itemName);
    }
    return instance.staticJson;
  }

  function readItemValue(itemName) {
    try {
      if (typeof window.apex !== 'undefined' && window.apex.item) {
        return window.apex.item(itemName).getValue();
      }
    } catch (e) {
      // fall through to direct DOM read
    }
    var node = document.getElementById(itemName);
    return node ? node.value : undefined;
  }

  /**
   * Initialize (or re-initialize) a PayloadLens region.
   * Called once by the plugin's render function via apex_javascript.add_onload_code.
   */
  function init(config) {
    if (!config || !config.staticId) {
      throw new Error('payloadLens.init requires { staticId }');
    }
    var root = document.getElementById(config.staticId + '_pl');
    if (!root) {
      return null;
    }
    var instance = createInstance(Object.assign({}, config, { root: root }));
    instances[instance.staticId] = instance;
    buildChrome(instance);
    renderPayload(instance, parsePayload(resolveInitialValue(instance)));
    return instance;
  }

  /** Re-reads the configured source (page item or static JSON) and re-renders. */
  function refresh(staticId) {
    var instance = instances[staticId];
    if (!instance) {
      return false;
    }
    renderPayload(instance, parsePayload(resolveInitialValue(instance)));
    return true;
  }

  /** Explicitly sets a new payload, bypassing the configured source. */
  function setPayload(staticId, value) {
    var instance = instances[staticId];
    if (!instance) {
      return false;
    }
    renderPayload(instance, parsePayload(value));
    return true;
  }

  function expandAll(staticId) {
    var instance = instances[staticId];
    if (!instance || !instance.treeModel) {
      return false;
    }
    setExpandedRecursive(instance.treeModel, true, instance);
    if (instance.displayMode === VIEW_TREE) {
      renderActiveView(instance);
    }
    return true;
  }

  function collapseAll(staticId) {
    var instance = instances[staticId];
    if (!instance || !instance.treeModel) {
      return false;
    }
    setExpandedRecursive(instance.treeModel, false, instance);
    instance.expanded[instance.treeModel.path] = true; // keep the root visible
    if (instance.displayMode === VIEW_TREE) {
      renderActiveView(instance);
    }
    return true;
  }

  function destroy(staticId) {
    var instance = instances[staticId];
    if (!instance) {
      return false;
    }
    clearElement(instance.root);
    instance.root.classList.remove('payload-lens');
    delete instances[staticId];
    return true;
  }

  // ===========================================================================
  // Exports
  // ===========================================================================

  return {
    // Public, documented API (see docs/javascript-api.md)
    init: init,
    refresh: refresh,
    setPayload: setPayload,
    expandAll: expandAll,
    collapseAll: collapseAll,
    destroy: destroy,

    // Exposed for unit testing (tests/*.test.js) and for advanced integrations.
    // Treat everything under `_internal` as unstable — it is not covered by
    // semantic versioning guarantees the way the functions above are.
    _internal: {
      parsePayload: parsePayload,
      maskPayload: maskPayload,
      calculateMetadata: calculateMetadata,
      buildTreeModel: buildTreeModel,
      tokenize: tokenize,
      DEFAULT_SENSITIVE_KEYS: DEFAULT_SENSITIVE_KEYS
    }
  };
});
