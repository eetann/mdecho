import { describe, expect, test } from "bun:test";
import {
  findActiveHeadingIndex,
  findCursorHeadingIndex,
  isAtBottom,
  scrollTopToReveal,
} from "./scroll-spy.ts";

describe("findActiveHeadingIndex", () => {
  test("returns -1 when there are no headings", () => {
    expect(findActiveHeadingIndex({ tops: [], threshold: 200, atBottom: false })).toBe(-1);
  });

  test("picks the lowest heading above the threshold", () => {
    expect(
      findActiveHeadingIndex({ tops: [-300, -50, 400], threshold: 200, atBottom: false }),
    ).toBe(1);
  });

  test("treats a heading exactly on the threshold as passed", () => {
    expect(
      findActiveHeadingIndex({ tops: [-100, 200, 600], threshold: 200, atBottom: false }),
    ).toBe(1);
  });

  test("keeps the previous heading while a long section fills the screen", () => {
    expect(findActiveHeadingIndex({ tops: [-2000, 900], threshold: 200, atBottom: false })).toBe(0);
  });

  test("falls back to the first heading while reading above it", () => {
    expect(findActiveHeadingIndex({ tops: [500, 900], threshold: 200, atBottom: false })).toBe(0);
  });

  test("picks the last heading at the bottom of the page even if it is below the threshold", () => {
    expect(findActiveHeadingIndex({ tops: [-900, 700], threshold: 200, atBottom: true })).toBe(1);
  });
});

describe("scrollTopToReveal", () => {
  test("keeps the current scroll position when the item is already visible", () => {
    expect(
      scrollTopToReveal({ itemTop: 120, itemHeight: 20, scrollTop: 100, viewHeight: 200 }),
    ).toBe(100);
  });

  test("scrolls up so the item sits at the top when it is above the view", () => {
    expect(
      scrollTopToReveal({ itemTop: 40, itemHeight: 20, scrollTop: 100, viewHeight: 200 }),
    ).toBe(40);
  });

  test("scrolls down so the item sits at the bottom when it is below the view", () => {
    expect(
      scrollTopToReveal({ itemTop: 380, itemHeight: 20, scrollTop: 100, viewHeight: 200 }),
    ).toBe(200);
  });

  test("keeps an item flush with the bottom edge as visible", () => {
    expect(
      scrollTopToReveal({ itemTop: 280, itemHeight: 20, scrollTop: 100, viewHeight: 200 }),
    ).toBe(100);
  });
});

describe("isAtBottom", () => {
  test("is true at the very bottom of a scrollable page", () => {
    expect(isAtBottom({ scrollY: 1200, viewHeight: 800, scrollHeight: 2000 })).toBe(true);
  });

  test("tolerates a sub-pixel gap at the bottom", () => {
    expect(isAtBottom({ scrollY: 1199, viewHeight: 800, scrollHeight: 2000 })).toBe(true);
  });

  test("is false in the middle of a scrollable page", () => {
    expect(isAtBottom({ scrollY: 400, viewHeight: 800, scrollHeight: 2000 })).toBe(false);
  });

  test("is false when the whole page fits on screen", () => {
    expect(isAtBottom({ scrollY: 0, viewHeight: 800, scrollHeight: 600 })).toBe(false);
  });
});

describe("findCursorHeadingIndex", () => {
  // 見出しがtargetsの0・4・9番目にある文書を想定する
  const positions = [0, 4, 9];

  test("returns -1 when there are no headings", () => {
    expect(findCursorHeadingIndex([], 3)).toBe(-1);
  });

  test("returns -1 when the cursor is not set yet", () => {
    expect(findCursorHeadingIndex(positions, -1)).toBe(-1);
  });

  test("picks the heading whose section contains the cursor", () => {
    expect(findCursorHeadingIndex(positions, 6)).toBe(1);
  });

  test("picks the heading itself when the cursor is on it", () => {
    expect(findCursorHeadingIndex(positions, 4)).toBe(1);
  });

  test("picks the last heading when the cursor is past all of them", () => {
    expect(findCursorHeadingIndex(positions, 30)).toBe(2);
  });

  test("falls back to the first heading when the cursor sits before it", () => {
    expect(findCursorHeadingIndex([2, 5], 1)).toBe(0);
  });
});
