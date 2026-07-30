import { describe, expect, test } from "bun:test";
import { computeLineParts, groupIndexAt, positionOfGroupIndex } from "./line-group.ts";

describe("groupIndexAt", () => {
  test("returns 0 for every position when there are no duplicate lines", () => {
    expect(groupIndexAt([1, 2, 3], 0)).toBe(0);
    expect(groupIndexAt([1, 2, 3], 2)).toBe(0);
  });

  test("counts prior occurrences of the same line value", () => {
    const lines = [1, 5, 5, 5, 5, 9];
    expect(groupIndexAt(lines, 1)).toBe(0);
    expect(groupIndexAt(lines, 2)).toBe(1);
    expect(groupIndexAt(lines, 3)).toBe(2);
    expect(groupIndexAt(lines, 4)).toBe(3);
  });

  test("returns 0 for an out-of-range position", () => {
    expect(groupIndexAt([1, 2, 3], 10)).toBe(0);
  });
});

describe("computeLineParts", () => {
  test("matches groupIndexAt for every position", () => {
    const lines = [1, 5, 5, 5, 5, 9];
    expect(computeLineParts(lines)).toEqual([0, 0, 1, 2, 3, 0]);
  });

  test("returns an empty array for an empty input", () => {
    expect(computeLineParts([])).toEqual([]);
  });
});

describe("positionOfGroupIndex", () => {
  test("resolves the exact occurrence when it exists", () => {
    const lines = [1, 5, 5, 5, 5, 9];
    expect(positionOfGroupIndex(lines, 5, 2)).toBe(3);
  });

  test("falls back to the first occurrence when groupIndex is out of range", () => {
    const lines = [1, 5, 5, 9];
    expect(positionOfGroupIndex(lines, 5, 99)).toBe(1);
  });

  test("returns null when the line value does not exist", () => {
    expect(positionOfGroupIndex([1, 2, 3], 42, 0)).toBeNull();
  });

  test("returns null for an empty array", () => {
    expect(positionOfGroupIndex([], 1, 0)).toBeNull();
  });
});
