import { describe, it, expect } from 'vitest';
import payloadLens from '../src/js/payload-lens.js';

const { maskPayload, DEFAULT_SENSITIVE_KEYS } = payloadLens._internal;

describe('maskPayload', () => {
  it('leaves non-sensitive keys untouched', () => {
    const input = { name: 'Acme Corp', country: 'US' };
    const result = maskPayload(input, {});
    expect(result).toEqual(input);
  });

  it('masks a key that exact-matches a sensitive key name', () => {
    const result = maskPayload({ password: 'hunter2' }, {});
    expect(result.password).not.toBe('hunter2');
    expect(result.password).toMatch(/^\*+$/);
  });

  it('does not mask a key that merely contains a sensitive substring', () => {
    // "passwordHint" is not an exact match for "password" — exact-key
    // matching is a deliberate design choice, not substring matching.
    const result = maskPayload({ passwordHint: 'your pet name' }, {});
    expect(result.passwordHint).toBe('your pet name');
  });

  it('is case-insensitive by default', () => {
    const result = maskPayload({ PASSWORD: 'hunter2', ApiKey: 'sk_test_123' }, {});
    expect(result.PASSWORD).toMatch(/^\*+$/);
    expect(result.ApiKey).toMatch(/^\*+$/);
  });

  it('honors caseSensitive: true and only masks an exact-case match', () => {
    const opts = { caseSensitive: true, sensitiveKeys: ['password'] };
    const result = maskPayload({ PASSWORD: 'hunter2', password: 'hunter2' }, opts);
    expect(result.PASSWORD).toBe('hunter2');
    expect(result.password).toMatch(/^\*+$/);
  });

  it('produces a length-preserving mask, clamped to the documented min/max bounds', () => {
    const short = maskPayload({ token: 'ab' }, {});
    expect(short.token).toHaveLength(3); // MIN_MASK_LENGTH

    const exact = maskPayload({ token: '12345678' }, {});
    expect(exact.token).toHaveLength(8);

    const long = maskPayload({ token: 'x'.repeat(200) }, {});
    expect(long.token).toHaveLength(32); // MAX_MASK_LENGTH
  });

  it('redacts an entire nested object subtree held by a sensitive key', () => {
    const input = { token: { value: 'abc', issuedAt: '2026-01-01' } };
    const result = maskPayload(input, {});
    expect(typeof result.token).toBe('string');
    expect(result.token).toMatch(/^\*+$/);
  });

  it('masks each element individually (not the whole array as one string) when a sensitive key holds an array', () => {
    // Unlike a nested object (which collapses to a single masked string),
    // an array held by a sensitive key stays an array: each element is
    // masked on its own, length-preserving, per element.
    const input = { token: ['abc', 'defgh'] };
    const result = maskPayload(input, {});
    expect(Array.isArray(result.token)).toBe(true);
    expect(result.token[0]).toMatch(/^\*+$/);
    expect(result.token[0]).toHaveLength(3);
    expect(result.token[1]).toMatch(/^\*+$/);
    expect(result.token[1]).toHaveLength(5);
  });

  it('redacts a nested object element inside an array held by a sensitive key', () => {
    const input = { token: [{ value: 'abc' }, { value: 'def' }] };
    const result = maskPayload(input, {});
    expect(Array.isArray(result.token)).toBe(true);
    expect(typeof result.token[0]).toBe('string');
    expect(result.token[0]).toMatch(/^\*+$/);
  });

  it('still walks and masks sensitive keys inside non-sensitive nested objects', () => {
    const input = { customer: { name: 'Ada', taxId: '123-45-6789' } };
    const result = maskPayload(input, {});
    expect(result.customer.name).toBe('Ada');
    expect(result.customer.taxId).toMatch(/^\*+$/);
  });

  it('masks sensitive keys found inside array elements', () => {
    const input = { items: [{ email: 'a@example.com' }, { email: 'b@example.com' }] };
    const result = maskPayload(input, {});
    expect(result.items[0].email).toMatch(/^\*+$/);
    expect(result.items[1].email).toMatch(/^\*+$/);
  });

  it('passes the value through unmodified (but cloned) when enabled: false', () => {
    const input = { password: 'hunter2' };
    const result = maskPayload(input, { enabled: false });
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('never mutates the input value', () => {
    const input = { password: 'hunter2', nested: { token: 'abc' } };
    const clone = JSON.parse(JSON.stringify(input));
    maskPayload(input, {});
    expect(input).toEqual(clone);
  });

  it('honors a custom sensitiveKeys list instead of the built-in defaults', () => {
    const result = maskPayload({ password: 'hunter2', secretCode: 'xyz' }, { sensitiveKeys: ['secretCode'] });
    expect(result.password).toBe('hunter2'); // not in the custom list
    expect(result.secretCode).toMatch(/^\*+$/);
  });

  it('honors a custom maskChar', () => {
    const result = maskPayload({ password: 'hunter2' }, { maskChar: '#' });
    expect(result.password).toMatch(/^#+$/);
  });

  it('treats null and undefined leaves as not maskable, even under a sensitive key', () => {
    const result = maskPayload({ password: null, token: undefined }, {});
    expect(result.password).toBeNull();
    expect(result.token).toBeUndefined();
  });

  it('exposes a non-empty built-in DEFAULT_SENSITIVE_KEYS list including common secrets', () => {
    expect(Array.isArray(DEFAULT_SENSITIVE_KEYS)).toBe(true);
    expect(DEFAULT_SENSITIVE_KEYS).toEqual(
      expect.arrayContaining(['password', 'token', 'apikey', 'secret'])
    );
  });
});
