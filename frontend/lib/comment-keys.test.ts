import { describe, expect, test } from "bun:test";
import { keyOf, parseKey } from "./comment-keys.ts";

describe("keyOf", () => {
  test("joins start and end line with a hyphen when sentenceIndex is omitted", () => {
    expect(keyOf(5, 5)).toBe("5-5");
    expect(keyOf(3, 7)).toBe("3-7");
  });

  test("explicit sentenceIndex 0 matches the omitted form", () => {
    expect(keyOf(5, 5, 0)).toBe("5-5");
  });

  test("non-zero sentenceIndex is appended with a colon", () => {
    expect(keyOf(46, 46, 3)).toBe("46-46:3");
  });
});

describe("parseKey", () => {
  test("round-trips with keyOf when sentenceIndex is 0", () => {
    expect(parseKey(keyOf(3, 7))).toEqual({ startLine: 3, endLine: 7, sentenceIndex: 0 });
    expect(parseKey(keyOf(9, 9))).toEqual({ startLine: 9, endLine: 9, sentenceIndex: 0 });
  });

  test("round-trips with keyOf when sentenceIndex is non-zero", () => {
    expect(parseKey(keyOf(46, 46, 2))).toEqual({ startLine: 46, endLine: 46, sentenceIndex: 2 });
  });

  test("interprets a legacy key (no sentenceIndex suffix) as sentenceIndex 0", () => {
    expect(parseKey("12-15")).toEqual({ startLine: 12, endLine: 15, sentenceIndex: 0 });
  });

  test("parses an explicit sentence suffix", () => {
    expect(parseKey("46-46:3")).toEqual({ startLine: 46, endLine: 46, sentenceIndex: 3 });
  });
});
