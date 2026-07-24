import { describe, expect, test } from "bun:test";
import { keyOf, parseKey } from "./comment-keys.ts";

describe("keyOf", () => {
  test("joins start and end line with a hyphen", () => {
    expect(keyOf(5, 5)).toBe("5-5");
    expect(keyOf(3, 7)).toBe("3-7");
  });
});

describe("parseKey", () => {
  test("round-trips with keyOf", () => {
    expect(parseKey(keyOf(3, 7))).toEqual({ startLine: 3, endLine: 7 });
    expect(parseKey(keyOf(9, 9))).toEqual({ startLine: 9, endLine: 9 });
  });
});
