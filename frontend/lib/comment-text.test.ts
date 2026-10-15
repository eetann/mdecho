import { describe, expect, test } from "bun:test";
import { buildInitialCommentText, insertQuote } from "./comment-text.ts";

describe("buildInitialCommentText", () => {
  test("wraps a single-line selection in backticks", () => {
    expect(buildInitialCommentText("hello")).toBe("`hello`");
  });

  test("trims trailing newlines before checking for multiline", () => {
    expect(buildInitialCommentText("hello\n")).toBe("`hello`");
  });

  test("quotes each line of a multi-line selection with a trailing blank line", () => {
    expect(buildInitialCommentText("foo\nbar")).toBe("> foo\n> bar\n\n");
  });
});

describe("insertQuote", () => {
  test("inserts an inline quote at the caret", () => {
    expect(insertQuote("ここはおかしい", 2, "`foo`")).toEqual({
      text: "ここ`foo`はおかしい",
      caret: 7,
    });
  });

  test("inserts into an empty text", () => {
    expect(insertQuote("", 0, "> foo\n\n")).toEqual({ text: "> foo\n\n", caret: 7 });
  });

  test("breaks the line before a block quote placed mid-line", () => {
    expect(insertQuote("直して", 3, "> foo\n\n")).toEqual({
      text: "直して\n> foo\n\n",
      caret: 11,
    });
  });

  test("does not add a line break when the caret is already at a line start", () => {
    expect(insertQuote("直して\n", 4, "> foo\n\n")).toEqual({
      text: "直して\n> foo\n\n",
      caret: 11,
    });
  });
});
