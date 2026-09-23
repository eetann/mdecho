import { describe, expect, test } from "bun:test";
import {
  buildContentWidthValue,
  buildLayoutCss,
  clampContentWidth,
  CONTENT_WIDTH_MAX,
  CONTENT_WIDTH_MIN,
  DEFAULT_CONTENT_WIDTH,
} from "./layout-css.ts";

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

describe("buildContentWidthValue", () => {
  test("px付きのCSS値にする", () => {
    expect(buildContentWidthValue(1440)).toBe("1440px");
  });
});

describe("buildLayoutCss", () => {
  test("既定と同じ幅なら何も注入しない", () => {
    expect(buildLayoutCss({ contentWidth: DEFAULT_CONTENT_WIDTH })).toBe("");
  });

  test("既定と違う幅ならCSS変数を上書きする", () => {
    expect(buildLayoutCss({ contentWidth: 1440 })).toContain("--mdecho-content-width: 1440px;");
  });
});
