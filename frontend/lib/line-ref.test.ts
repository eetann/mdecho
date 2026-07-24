import { describe, expect, test } from "bun:test";
import { formatLineRef } from "./line-ref.ts";

describe("formatLineRef", () => {
  test("single line uses L{n} form", () => {
    expect(formatLineRef(9, 9)).toBe("L9");
  });

  test("range uses L{start}-{end} form with a single leading L", () => {
    expect(formatLineRef(9, 12)).toBe("L9-12");
  });
});
