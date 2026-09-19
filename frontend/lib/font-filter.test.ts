import { describe, expect, test } from "bun:test";
import { filterFonts, MAX_FONT_CANDIDATES } from "./font-filter.ts";
import type { SystemFont } from "./types.ts";

const FONTS: SystemFont[] = [
  { name: "Arial", aliases: [] },
  { name: "BIZ UDPGothic", aliases: ["BIZ UDPゴシック"] },
  { name: "Meiryo", aliases: ["メイリオ"] },
  { name: "Yu Gothic", aliases: ["游ゴシック"] },
];

const names = (fonts: SystemFont[]) => fonts.map((font) => font.name);

describe("filterFonts", () => {
  test("空の入力なら全部返す", () => {
    expect(names(filterFonts(FONTS, "", []).fonts)).toEqual([
      "Arial",
      "BIZ UDPGothic",
      "Meiryo",
      "Yu Gothic",
    ]);
  });

  test("選択済みのフォントは候補から外す", () => {
    expect(names(filterFonts(FONTS, "", ["Arial", "Meiryo"]).fonts)).toEqual([
      "BIZ UDPGothic",
      "Yu Gothic",
    ]);
  });

  test("別名でも引ける", () => {
    expect(names(filterFonts(FONTS, "メイリオ", []).fonts)).toEqual(["Meiryo"]);
    expect(names(filterFonts(FONTS, "ゴシック", []).fonts)).toEqual(["BIZ UDPGothic", "Yu Gothic"]);
  });

  test("大文字小文字を区別しない", () => {
    expect(names(filterFonts(FONTS, "aRiAl", []).fonts)).toEqual(["Arial"]);
  });

  test("前方一致を部分一致より先に出す", () => {
    const fonts: SystemFont[] = [
      { name: "Noto Sans Gothic", aliases: [] },
      { name: "Gothic A1", aliases: [] },
    ];
    expect(names(filterFonts(fonts, "gothic", []).fonts)).toEqual([
      "Gothic A1",
      "Noto Sans Gothic",
    ]);
  });

  test("前後の空白は無視する", () => {
    expect(names(filterFonts(FONTS, "  meiryo  ", []).fonts)).toEqual(["Meiryo"]);
  });

  test("一致しなければ空", () => {
    const result = filterFonts(FONTS, "存在しないフォント", []);
    expect(result.fonts).toEqual([]);
    expect(result.omitted).toBe(0);
  });

  test("上限を超えた分は件数だけ返す", () => {
    const many: SystemFont[] = Array.from({ length: MAX_FONT_CANDIDATES + 5 }, (_, i) => ({
      name: `Font ${i}`,
      aliases: [],
    }));
    const result = filterFonts(many, "", []);
    expect(result.fonts).toHaveLength(MAX_FONT_CANDIDATES);
    expect(result.omitted).toBe(5);
  });
});
