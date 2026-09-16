import { describe, it, expect } from 'vitest';
import payloadLens from '../src/js/payload-lens.js';

const { calculateMetadata } = payloadLens._internal;

describe('calculateMetadata', () => {
  it('reports zero counts and depth 0 for an empty object', () => {
    expect(calculateMetadata({})).toEqual({
      sizeBytes: 2, // "{}"
      propertyCount: 0,
      arrayElementCount: 0,
      maxDepth: 0
    });
  });

  it('reports zero counts and depth 0 for an empty array', () => {
    expect(calculateMetadata([])).toEqual({
      sizeBytes: 2, // "[]"
      propertyCount: 0,
      arrayElementCount: 0,
      maxDepth: 0
    });
  });

  it('counts a flat object\'s own keys as propertyCount and depth 1', () => {
    const result = calculateMetadata({ a: 1, b: 2, c: 3 });
    expect(result.propertyCount).toBe(3);
    expect(result.arrayElementCount).toBe(0);
    expect(result.maxDepth).toBe(1);
  });

  it('counts a flat array\'s elements as arrayElementCount and depth 1', () => {
    const result = calculateMetadata([1, 2, 3, 4]);
    expect(result.arrayElementCount).toBe(4);
    expect(result.propertyCount).toBe(0);
    expect(result.maxDepth).toBe(1);
  });

  it('accumulates propertyCount and maxDepth across nested objects', () => {
    const result = calculateMetadata({ a: { b: { c: 1 } } });
    expect(result.propertyCount).toBe(3); // a, b, c
    expect(result.maxDepth).toBe(3); // value 1 sits at depth 3
  });

  it('accumulates arrayElementCount and maxDepth across nested arrays', () => {
    const result = calculateMetadata([[1, 2], [3, 4, 5]]);
    expect(result.arrayElementCount).toBe(2 + 2 + 3); // outer array (2) + both inner arrays (2 + 3)
    expect(result.maxDepth).toBe(2);
  });

  it('counts both object properties and array elements in a mixed structure', () => {
    const result = calculateMetadata({ items: [{ id: 1 }, { id: 2 }] });
    // propertyCount: "items" (1) + "id" x2 (2) = 3
    expect(result.propertyCount).toBe(3);
    expect(result.arrayElementCount).toBe(2);
    expect(result.maxDepth).toBe(3); // items -> [] -> {id} -> 1
  });

  it('treats a bare scalar root as depth 0 with no property/array counts', () => {
    const result = calculateMetadata(42);
    expect(result).toEqual({ sizeBytes: 2, propertyCount: 0, arrayElementCount: 0, maxDepth: 0 });
  });

  it('treats a null root as depth 0 with no property/array counts', () => {
    const result = calculateMetadata(null);
    expect(result).toEqual({ sizeBytes: 4, propertyCount: 0, arrayElementCount: 0, maxDepth: 0 }); // "null"
  });

  it('substitutes null for an undefined root when computing sizeBytes', () => {
    const result = calculateMetadata(undefined);
    expect(result.sizeBytes).toBe(4); // JSON.stringify(null) === "null"
    expect(result.propertyCount).toBe(0);
    expect(result.arrayElementCount).toBe(0);
    expect(result.maxDepth).toBe(0);
  });

  it('computes sizeBytes as the UTF-8 byte length of the stringified value, not the character length', () => {
    // Each "é" is 1 UTF-16 char but 2 bytes in UTF-8.
    const result = calculateMetadata({ name: 'café' });
    const expectedJson = JSON.stringify({ name: 'café' });
    expect(result.sizeBytes).toBeGreaterThan(expectedJson.length);
  });

  it('computes structural counts from the original unmasked value, independent of masking', () => {
    // calculateMetadata never touches masking; it just counts shape/size
    // structurally, regardless of what keys are named.
    const result = calculateMetadata({ password: 'hunter2', nested: { token: 'abc' } });
    expect(result.propertyCount).toBe(3); // password, nested, token
    expect(result.maxDepth).toBe(2);
  });
});
