import { describe, expect, test } from "bun:test";
import { clampFileListWidth, MIN_FILE_LIST_WIDTH } from "./file-list-width.ts";

describe("clampFileListWidth", () => {
  test("範囲内ならそのまま(整数に丸める)", () => {
    expect(clampFileListWidth(250.4, 1600)).toBe(250);
  });

  test("最小幅より狭くはならない", () => {
    expect(clampFileListWidth(10, 1600)).toBe(MIN_FILE_LIST_WIDTH);
  });

  test("画面幅の4割を超えない", () => {
    expect(clampFileListWidth(600, 1300)).toBe(520);
  });

  test("広い画面でも640pxを超えない", () => {
    expect(clampFileListWidth(2000, 4000)).toBe(640);
  });

  test("画面が極端に狭くても最小幅は保つ", () => {
    expect(clampFileListWidth(300, 200)).toBe(MIN_FILE_LIST_WIDTH);
  });
});
