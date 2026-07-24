import { describe, expect, test } from "bun:test";
import { buildInitialCommentText } from "./comment-text.ts";

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
