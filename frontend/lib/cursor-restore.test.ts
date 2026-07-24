import { describe, expect, test } from "bun:test";
import { findRestoreIndex } from "./cursor-restore.ts";

describe("findRestoreIndex", () => {
  test("returns -1 sentinel when there are no targets", () => {
    expect(findRestoreIndex([], 5)).toBe(-1);
  });

  test("returns 0 when there is no stored line", () => {
    expect(findRestoreIndex([1, 5, 9], null)).toBe(0);
  });

  test("returns 0 when the stored line is NaN", () => {
    expect(findRestoreIndex([1, 5, 9], Number.NaN)).toBe(0);
  });

  test("returns the index of the first target at or after the stored line", () => {
    expect(findRestoreIndex([1, 5, 9], 4)).toBe(1);
    expect(findRestoreIndex([1, 5, 9], 5)).toBe(1);
  });

  test("returns the last index when the stored line is beyond all targets", () => {
    expect(findRestoreIndex([1, 5, 9], 100)).toBe(2);
  });
});
