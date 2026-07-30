import { describe, expect, test } from "bun:test";
import { findRestoreIndex, formatCursorKey, parseCursorKey } from "./cursor-restore.ts";

describe("findRestoreIndex", () => {
  test("returns -1 sentinel when there are no targets", () => {
    expect(findRestoreIndex([], [], { line: 5, part: 0 })).toBe(-1);
  });

  test("returns 0 when there is no stored key", () => {
    expect(findRestoreIndex([1, 5, 9], [0, 0, 0], null)).toBe(0);
  });

  test("returns 0 when the stored line is NaN", () => {
    expect(findRestoreIndex([1, 5, 9], [0, 0, 0], { line: Number.NaN, part: 0 })).toBe(0);
  });

  test("returns the index of the first target at or after the stored line (parts all 0)", () => {
    expect(findRestoreIndex([1, 5, 9], [0, 0, 0], { line: 4, part: 0 })).toBe(1);
    expect(findRestoreIndex([1, 5, 9], [0, 0, 0], { line: 5, part: 0 })).toBe(1);
  });

  test("returns the last index when the stored line is beyond all targets", () => {
    expect(findRestoreIndex([1, 5, 9], [0, 0, 0], { line: 100, part: 0 })).toBe(2);
  });

  test("resolves the matching part within the same line", () => {
    const lines = [1, 46, 46, 46, 46, 90];
    const parts = [0, 0, 1, 2, 3, 0];
    expect(findRestoreIndex(lines, parts, { line: 46, part: 2 })).toBe(3);
  });

  test("falls back to the next line when the stored part exceeds the available candidates", () => {
    const lines = [1, 46, 46, 90];
    const parts = [0, 0, 1, 0];
    expect(findRestoreIndex(lines, parts, { line: 46, part: 5 })).toBe(3);
  });
});

describe("formatCursorKey / parseCursorKey", () => {
  test("part 0 round-trips through the legacy plain-number format", () => {
    const key = formatCursorKey(46, 0);
    expect(key).toBe("46");
    expect(parseCursorKey(key)).toEqual({ line: 46, part: 0 });
  });

  test("non-zero part round-trips through the line:part format", () => {
    const key = formatCursorKey(46, 2);
    expect(key).toBe("46:2");
    expect(parseCursorKey(key)).toEqual({ line: 46, part: 2 });
  });

  test("parseCursorKey interprets a legacy stored value as part 0", () => {
    expect(parseCursorKey("46")).toEqual({ line: 46, part: 0 });
  });

  test("parseCursorKey returns null for null input", () => {
    expect(parseCursorKey(null)).toBeNull();
  });

  test("parseCursorKey returns null for a non-numeric line", () => {
    expect(parseCursorKey("abc")).toBeNull();
  });
});
