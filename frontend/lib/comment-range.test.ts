import { describe, expect, test } from "bun:test";
import { resolveCommentRange } from "./comment-range.ts";

describe("resolveCommentRange", () => {
  const lines = [1, 3, 5, 5, 8];
  const lineEnds = [2, 3, 5, 5, 10];

  test("uses data-line only when the drag stays on a single target", () => {
    expect(resolveCommentRange(lines, lineEnds, 0, 0)).toEqual({
      startIndex: 0,
      endIndex: 0,
      startLine: 1,
      endLine: 1,
      sentenceIndex: 0,
    });
  });

  test("extends the end to data-line-end when the drag covers multiple targets", () => {
    expect(resolveCommentRange(lines, lineEnds, 1, 4)).toEqual({
      startIndex: 1,
      endIndex: 4,
      startLine: 3,
      endLine: 10,
      sentenceIndex: 0,
    });
  });

  test("orders the range when dragged upward", () => {
    expect(resolveCommentRange(lines, lineEnds, 4, 1)).toEqual({
      startIndex: 1,
      endIndex: 4,
      startLine: 3,
      endLine: 10,
      sentenceIndex: 0,
    });
  });

  test("reports the sentence index of the end target", () => {
    expect(resolveCommentRange(lines, lineEnds, 1, 3)?.sentenceIndex).toBe(1);
  });

  test("falls back to data-line when data-line-end is missing", () => {
    expect(resolveCommentRange([1, 4], [1], 0, 1)?.endLine).toBe(4);
  });

  test("returns null for an out-of-range index", () => {
    expect(resolveCommentRange(lines, lineEnds, 0, 99)).toBeNull();
    expect(resolveCommentRange([], [], 0, 0)).toBeNull();
  });
});
