import { describe, expect, test } from "bun:test";
import { resolveCommentMark } from "./comment-marks.ts";

describe("resolveCommentMark", () => {
  const lines = [1, 3, 5, 5, 8];

  test("points at a single target for a single line key", () => {
    expect(resolveCommentMark(lines, "3-3")).toEqual({ key: "3-3", startIndex: 1, endIndex: 1 });
  });

  test("uses the sentence index to pick one of the sentences on a line", () => {
    expect(resolveCommentMark(lines, "5-5:1")).toEqual({
      key: "5-5:1",
      startIndex: 3,
      endIndex: 3,
    });
  });

  test("covers every target inside a multi line range", () => {
    expect(resolveCommentMark(lines, "3-5")).toEqual({ key: "3-5", startIndex: 1, endIndex: 3 });
  });

  test("keeps the range when its end line has no target of its own", () => {
    // data-line-endが終端要素のまたぐ最終行(ここでは10)になるケース
    expect(resolveCommentMark(lines, "5-10")).toEqual({ key: "5-10", startIndex: 2, endIndex: 4 });
  });

  test("starts at the first target inside the range when the start line is gone", () => {
    expect(resolveCommentMark(lines, "2-5")).toEqual({ key: "2-5", startIndex: 1, endIndex: 3 });
  });

  test("returns null when no target falls inside the range", () => {
    expect(resolveCommentMark(lines, "6-7")).toBeNull();
    expect(resolveCommentMark(lines, "20-30")).toBeNull();
    expect(resolveCommentMark([], "1-3")).toBeNull();
  });
});
