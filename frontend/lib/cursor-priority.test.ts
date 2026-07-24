import { describe, expect, test } from "bun:test";
import { comparePriority, priorityOf } from "./cursor-priority.ts";

describe("priorityOf", () => {
  test("headings all share the top priority", () => {
    expect(priorityOf("H1")).toBe(0);
    expect(priorityOf("H6")).toBe(0);
  });

  test("unknown tags fall back to the lowest priority", () => {
    expect(priorityOf("DIV")).toBe(99);
  });
});

describe("comparePriority", () => {
  test("headings beat table rows", () => {
    expect(comparePriority("H2", "TR")).toBeLessThan(0);
  });

  test("table rows beat list items, which beat blockquotes, which beat paragraphs", () => {
    expect(comparePriority("TR", "LI")).toBeLessThan(0);
    expect(comparePriority("LI", "BLOCKQUOTE")).toBeLessThan(0);
    expect(comparePriority("BLOCKQUOTE", "P")).toBeLessThan(0);
  });

  test("equal-priority tags compare equal", () => {
    expect(comparePriority("H1", "H3")).toBe(0);
  });
});
