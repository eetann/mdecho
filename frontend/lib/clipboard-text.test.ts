import { describe, expect, test } from "bun:test";
import { buildClipboardText } from "./clipboard-text.ts";

describe("buildClipboardText", () => {
  test("formats a single-line ref without a range", () => {
    const text = buildClipboardText("foo.md", [{ startLine: 9, endLine: 9, text: "hello" }]);
    expect(text).toBe("foo.md:L9\nhello");
  });

  test("formats a multi-line ref with L on both sides (differs from formatLineRef)", () => {
    const text = buildClipboardText("foo.md", [{ startLine: 9, endLine: 12, text: "hello" }]);
    expect(text).toBe("foo.md:L9-L12\nhello");
  });

  test("sorts by startLine ascending and joins entries with a separator", () => {
    const text = buildClipboardText("foo.md", [
      { startLine: 20, endLine: 20, text: "second" },
      { startLine: 5, endLine: 5, text: "first" },
    ]);
    expect(text).toBe("foo.md:L5\nfirst\n\n---\n\nfoo.md:L20\nsecond");
  });
});
