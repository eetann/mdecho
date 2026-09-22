import { describe, expect, test } from "bun:test";
import { buildClipboardText } from "./clipboard-text.ts";

describe("buildClipboardText", () => {
  test("formats a single-line ref without a range", () => {
    const text = buildClipboardText([
      { filePath: "foo.md", comments: [{ startLine: 9, endLine: 9, text: "hello" }] },
    ]);
    expect(text).toBe("foo.md:L9\nhello");
  });

  test("formats a multi-line ref with L on both sides (differs from formatLineRef)", () => {
    const text = buildClipboardText([
      { filePath: "foo.md", comments: [{ startLine: 9, endLine: 12, text: "hello" }] },
    ]);
    expect(text).toBe("foo.md:L9-L12\nhello");
  });

  test("sorts by startLine ascending and joins entries with a separator", () => {
    const text = buildClipboardText([
      {
        filePath: "foo.md",
        comments: [
          { startLine: 20, endLine: 20, text: "second" },
          { startLine: 5, endLine: 5, text: "first" },
        ],
      },
    ]);
    expect(text).toBe("foo.md:L5\nfirst\n\n---\n\nfoo.md:L20\nsecond");
  });

  test("keeps the given file order and sorts only within each file", () => {
    const text = buildClipboardText([
      { filePath: "docs/b.md", comments: [{ startLine: 2, endLine: 2, text: "b2" }] },
      {
        filePath: "docs/a.md",
        comments: [
          { startLine: 7, endLine: 7, text: "a7" },
          { startLine: 1, endLine: 1, text: "a1" },
        ],
      },
    ]);
    expect(text).toBe("docs/b.md:L2\nb2\n\n---\n\ndocs/a.md:L1\na1\n\n---\n\ndocs/a.md:L7\na7");
  });

  test("skips files that have no comments", () => {
    const text = buildClipboardText([
      { filePath: "docs/empty.md", comments: [] },
      { filePath: "docs/a.md", comments: [{ startLine: 1, endLine: 1, text: "a1" }] },
    ]);
    expect(text).toBe("docs/a.md:L1\na1");
  });
});
