import { describe, it, expect } from 'vitest';
import payloadLens from '../src/js/payload-lens.js';

const { parsePayload } = payloadLens._internal;

describe('parsePayload', () => {
  it('parses a valid JSON object string into an "ok" descriptor', () => {
    const result = parsePayload('{"a":1,"b":[1,2,3]}');
    expect(result.status).toBe('ok');
    expect(result.value).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('accepts an already-parsed JS value (not a string) and classifies it directly', () => {
    const result = parsePayload({ a: 1 });
    expect(result.status).toBe('ok');
    expect(result.value).toEqual({ a: 1 });
  });

  it('returns a well-defined error descriptor for invalid JSON text, never throws', () => {
    expect(() => parsePayload('{not valid json')).not.toThrow();
    const result = parsePayload('{not valid json');
    expect(result.status).toBe('error');
    expect(result.error).toBeTruthy();
    expect(result.error.message).toBe('Invalid JSON payload');
    expect(typeof result.error.detail).toBe('string');
    expect(result.error.detail.length).toBeGreaterThan(0);
  });

  it('treats undefined as an empty payload', () => {
    const result = parsePayload(undefined);
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('undefined');
  });

  it('treats null as an empty payload', () => {
    const result = parsePayload(null);
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('null');
  });

  it('treats an empty string as an empty payload', () => {
    const result = parsePayload('');
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('empty-string');
  });

  it('treats a whitespace-only string as an empty payload', () => {
    const result = parsePayload('   \n\t  ');
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('empty-string');
  });

  it('treats an empty JSON object as an empty payload, not an error', () => {
    const result = parsePayload('{}');
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('empty-object');
  });

  it('treats an empty JSON array as an empty payload, not an error', () => {
    const result = parsePayload('[]');
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('empty-array');
  });

  it('treats a JSON null literal as an empty payload', () => {
    const result = parsePayload('null');
    expect(result.status).toBe('empty');
    expect(result.emptyKind).toBe('null');
  });

  it('accepts a bare JSON scalar (number/boolean/string) as "ok"', () => {
    expect(parsePayload('42')).toEqual({ status: 'ok', value: 42 });
    expect(parsePayload('true')).toEqual({ status: 'ok', value: true });
    expect(parsePayload('"hello"')).toEqual({ status: 'ok', value: 'hello' });
  });

  it('does not itself enforce any maximum size — parsePayload has no size awareness', () => {
    // The "Maximum Display Size" limit is enforced later, in the render
    // path (renderPayload -> renderTooLargeState), not inside parsePayload.
    // A payload larger than the plugin's default 1 MiB display limit still
    // parses successfully here.
    const bigArray = new Array(200000).fill('x');
    const result = parsePayload(JSON.stringify(bigArray));
    expect(result.status).toBe('ok');
    expect(result.value).toHaveLength(200000);
  });
});

describe('renderPayload (via payloadLens.init) — maxDisplayBytes enforcement', () => {
  it('renders a "too large" state instead of the tree when the payload exceeds maxDisplayBytes', () => {
    document.body.innerHTML = '<div id="BIG_pl"></div>';
    const bigValue = { data: 'x'.repeat(5000) };

    const instance = payloadLens.init({
      staticId: 'BIG',
      staticJson: JSON.stringify(bigValue),
      maxDisplayBytes: 100
    });

    expect(instance).not.toBeNull();
    const viewport = document.getElementById('BIG_pl').querySelector('.payload-lens__viewport');
    expect(viewport.querySelector('.payload-lens__error-title').textContent).toMatch(/too large/i);
    expect(viewport.querySelector('.payload-lens__tree')).toBeNull();

    payloadLens.destroy('BIG');
  });

  it('renders the tree normally when the payload is within maxDisplayBytes', () => {
    document.body.innerHTML = '<div id="SMALL_pl"></div>';
    const instance = payloadLens.init({
      staticId: 'SMALL',
      staticJson: JSON.stringify({ a: 1 })
    });

    expect(instance).not.toBeNull();
    const viewport = document.getElementById('SMALL_pl').querySelector('.payload-lens__viewport');
    expect(viewport.querySelector('.payload-lens__error-title')).toBeNull();

    payloadLens.destroy('SMALL');
  });
});
