import { describe, expect, test } from "bun:test";
import {
  buildContentWidthValue,
  buildFontSizeValue,
  buildLayoutCss,
  buildLineHeightValue,
  clampContentWidth,
  clampFontSize,
  clampLineHeight,
  CONTENT_WIDTH_MAX,
  CONTENT_WIDTH_MIN,
  DEFAULT_CONTENT_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type LayoutConfig,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
} from "./layout-css.ts";

const DEFAULTS: LayoutConfig = {
  contentWidth: DEFAULT_CONTENT_WIDTH,
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: DEFAULT_LINE_HEIGHT,
};

describe("clampContentWidth", () => {
  test("範囲内の値はそのまま返す", () => {
    expect(clampContentWidth(1440)).toBe(1440);
  });

  test("範囲外は両端で頭打ちにする", () => {
    expect(clampContentWidth(0)).toBe(CONTENT_WIDTH_MIN);
    expect(clampContentWidth(99999)).toBe(CONTENT_WIDTH_MAX);
  });

  test("小数は丸める", () => {
    expect(clampContentWidth(1024.4)).toBe(1024);
  });
});

describe("clampFontSize", () => {
  test("範囲外は両端で頭打ちにする", () => {
    expect(clampFontSize(0)).toBe(FONT_SIZE_MIN);
    expect(clampFontSize(99)).toBe(FONT_SIZE_MAX);
  });

  test("小数は丸める", () => {
    expect(clampFontSize(17.6)).toBe(18);
  });
});

describe("clampLineHeight", () => {
  test("範囲外は両端で頭打ちにする", () => {
    expect(clampLineHeight(0.5)).toBe(LINE_HEIGHT_MIN);
    expect(clampLineHeight(9)).toBe(LINE_HEIGHT_MAX);
  });

  test("倍率なので小数はそのまま残す", () => {
    expect(clampLineHeight(1.85)).toBe(1.85);
  });

  test("二進小数の端数は小数2桁へ丸める", () => {
    expect(clampLineHeight(1.7500000000000002)).toBe(1.75);
    expect(clampLineHeight(1.777)).toBe(1.78);
  });
});

describe("CSS値への変換", () => {
  test("幅と文字サイズはpxを付ける", () => {
    expect(buildContentWidthValue(1440)).toBe("1440px");
    expect(buildFontSizeValue(18)).toBe("18px");
  });

  test("行の高さは単位なしの倍率にする", () => {
    expect(buildLineHeightValue(1.9)).toBe("1.9");
  });
});

describe("buildLayoutCss", () => {
  test("全部が既定のままなら何も注入しない", () => {
    expect(buildLayoutCss(DEFAULTS)).toBe("");
  });

  test("既定と違う項目だけCSS変数を上書きする", () => {
    const css = buildLayoutCss({ ...DEFAULTS, contentWidth: 1440 });
    expect(css).toContain("--mdecho-content-width: 1440px;");
    expect(css).not.toContain("--mdecho-font-size");
    expect(css).not.toContain("--mdecho-line-height");
  });

  test("文字サイズと行の高さも上書きできる", () => {
    const css = buildLayoutCss({ ...DEFAULTS, fontSize: 18, lineHeight: 1.9 });
    expect(css).toContain("--mdecho-font-size: 18px;");
    expect(css).toContain("--mdecho-line-height: 1.9;");
  });
});
