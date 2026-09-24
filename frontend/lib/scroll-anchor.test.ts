import { describe, expect, test } from "bun:test";
import { findAnchorIndex, formatScrollAnchor, parseScrollAnchor } from "./scroll-anchor.ts";

describe("findAnchorIndex", () => {
  test("returns -1 sentinel when there are no targets", () => {
    expect(findAnchorIndex([], 72)).toBe(-1);
  });

  test("returns the lowest target that starts above the threshold", () => {
    expect(findAnchorIndex([-300, -120, 40, 500], 72)).toBe(2);
  });

  test("treats a target sitting exactly on the threshold as visible", () => {
    expect(findAnchorIndex([-300, 72, 500], 72)).toBe(1);
  });

  test("returns 0 while every target is still below the threshold", () => {
    expect(findAnchorIndex([120, 400, 900], 72)).toBe(0);
  });

  test("returns the last index when every target has scrolled past the threshold", () => {
    expect(findAnchorIndex([-900, -400, -120], 72)).toBe(2);
  });
});

describe("formatScrollAnchor / parseScrollAnchor", () => {
  test("round-trips through the line:part:offset format", () => {
    const raw = formatScrollAnchor({ line: 46, part: 2, offset: -18 });
    expect(raw).toBe("46:2:-18");
    expect(parseScrollAnchor(raw)).toEqual({ line: 46, part: 2, offset: -18 });
  });

  test("rounds the sub-pixel offset getBoundingClientRect returns", () => {
    expect(formatScrollAnchor({ line: 46, part: 0, offset: -17.6 })).toBe("46:0:-18");
  });

  test("returns null for null input", () => {
    expect(parseScrollAnchor(null)).toBeNull();
  });

  test("returns null for a value that is missing the offset", () => {
    expect(parseScrollAnchor("46:2")).toBeNull();
  });

  test("returns null for a non-numeric value", () => {
    expect(parseScrollAnchor("abc")).toBeNull();
  });
});
