import { describe, expect, test } from "bun:test";
import { resolveInitialReadMode } from "./read-mode-store.ts";

describe("resolveInitialReadMode", () => {
  test("切り替えたことが無ければ--readの指定に従う", () => {
    expect(resolveInitialReadMode(null, true)).toBe(true);
    expect(resolveInitialReadMode(null, false)).toBe(false);
  });

  test("切り替えたことがあれば、--readより保存した値を優先する", () => {
    expect(resolveInitialReadMode(false, true)).toBe(false);
    expect(resolveInitialReadMode(true, false)).toBe(true);
  });
});
