import { describe, expect, test } from "bun:test";
import { excludeLinesCoveredBySentences } from "./sentence-cover.ts";

describe("excludeLinesCoveredBySentences", () => {
  const lineOf = (el: { line: number }) => el.line;

  test("drops the paragraph whose line is split into sentences", () => {
    const elements = [{ name: "p", line: 1 }];
    expect(excludeLinesCoveredBySentences(elements, new Set([1]), lineOf)).toEqual([]);
  });

  test("keeps a parent list item whose sentences live only in a nested list", () => {
    // - 親アイテム
    //     - 子その1。子その2。
    const parent = { name: "li", line: 1 };
    const child = { name: "li", line: 2 };
    expect(excludeLinesCoveredBySentences([parent, child], new Set([2]), lineOf)).toEqual([parent]);
  });
});
