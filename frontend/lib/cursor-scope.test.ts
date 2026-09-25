import { describe, expect, test } from "bun:test";
import { clampToCursorScope, findCursorScope } from "./cursor-scope.ts";

describe("findCursorScope", () => {
  test("returns null when nothing is in scope", () => {
    expect(findCursorScope([false, false, false])).toBeNull();
    expect(findCursorScope([])).toBeNull();
  });

  test("returns the first and last index in scope", () => {
    expect(findCursorScope([false, true, true, true, false])).toEqual({ start: 1, end: 3 });
  });

  test("returns the same index for a single row", () => {
    expect(findCursorScope([false, true, false])).toEqual({ start: 1, end: 1 });
  });

  // 表の行はtargetsの並びで連続するが、万一飛んでいても両端で挟む
  test("spans over a gap", () => {
    expect(findCursorScope([true, false, true])).toEqual({ start: 0, end: 2 });
  });
});

describe("clampToCursorScope", () => {
  const scope = { start: 2, end: 5 };

  test("keeps an index inside the scope", () => {
    expect(clampToCursorScope(3, scope)).toBe(3);
  });

  test("stops at both ends", () => {
    expect(clampToCursorScope(6, scope)).toBe(5);
    expect(clampToCursorScope(1, scope)).toBe(2);
  });

  test("pulls a far-away index to the nearest end", () => {
    expect(clampToCursorScope(100, scope)).toBe(5);
    expect(clampToCursorScope(-100, scope)).toBe(2);
  });
});
