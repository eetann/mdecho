import { expect, test } from "bun:test";
import { allocateColumnWidths, MIN_COLUMN_WIDTH, pickFontScale } from "./table-layout.ts";

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

test("カラムが無ければ空配列", () => {
  expect(allocateColumnWidths([], 900)).toEqual([]);
});

test("自然幅が収まるときはコンテナ幅いっぱいまで比例配分する", () => {
  const widths = allocateColumnWidths([100, 300], 800);
  expect(sum(widths)).toBeCloseTo(800);
  expect(widths[0]).toBeCloseTo(200);
  expect(widths[1]).toBeCloseTo(600);
});

test("収まらないときは狭いカラムを自然幅のまま残し、広いカラムだけ縮める", () => {
  const widths = allocateColumnWidths([60, 80, 1000], 600);
  expect(widths[0]).toBeCloseTo(60);
  expect(widths[1]).toBeCloseTo(80);
  expect(widths[2]).toBeCloseTo(460);
  expect(sum(widths)).toBeCloseTo(600);
});

test("広いカラムが複数あるときは残り幅を均等に分け合う", () => {
  const widths = allocateColumnWidths([40, 500, 700], 640);
  expect(widths[0]).toBeCloseTo(40);
  expect(widths[1]).toBeCloseTo(300);
  expect(widths[2]).toBeCloseTo(300);
});

test("コンテナが狭すぎるときは最小幅を下回らせない(はみ出しは横スクロールに任せる)", () => {
  const widths = allocateColumnWidths([300, 300, 300], 60);
  expect(widths).toEqual([MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH, MIN_COLUMN_WIDTH]);
});

test("はみ出し量に応じてフォント倍率を段階的に下げる", () => {
  expect(pickFontScale(900, 900)).toBe(1);
  expect(pickFontScale(1340, 900)).toBe(1);
  expect(pickFontScale(1350, 900)).toBe(0.92);
  expect(pickFontScale(2160, 900)).toBe(0.85);
});

test("コンテナ幅が測れないときはフォント倍率を変えない", () => {
  expect(pickFontScale(1000, 0)).toBe(1);
});
