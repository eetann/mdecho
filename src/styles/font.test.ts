import { describe, expect, test } from "bun:test";
import { buildFontCss, toFontFamilyToken, toFontFamilyValue } from "./font.ts";

describe("toFontFamilyToken", () => {
  test("空白を含む名前は引用符で囲む", () => {
    expect(toFontFamilyToken("Noto Sans JP")).toBe('"Noto Sans JP"');
  });

  test("汎用ファミリーは引用符を付けない", () => {
    expect(toFontFamilyToken("sans-serif")).toBe("sans-serif");
    expect(toFontFamilyToken("ui-monospace")).toBe("ui-monospace");
  });

  test("identとして書ける名前は引用符を付けない", () => {
    expect(toFontFamilyToken("Roboto")).toBe("Roboto");
    // -apple-systemは引用符を付けるとSafariで解決されなくなるため、そのまま出す
    expect(toFontFamilyToken("-apple-system")).toBe("-apple-system");
  });

  test("日本語のフォント名は引用符で囲む", () => {
    expect(toFontFamilyToken("游ゴシック")).toBe('"游ゴシック"');
  });

  test("前後の空白は取り除く", () => {
    expect(toFontFamilyToken("  Inter  ")).toBe("Inter");
  });

  test("CSSやHTMLの構文を壊しうる名前は読み飛ばす", () => {
    expect(toFontFamilyToken("")).toBeUndefined();
    expect(toFontFamilyToken("   ")).toBeUndefined();
    expect(toFontFamilyToken('Inter"; color: red')).toBeUndefined();
    expect(toFontFamilyToken("Inter</style><script>alert(1)</script>")).toBeUndefined();
    expect(toFontFamilyToken("Inter\nmonospace")).toBeUndefined();
  });
});

describe("toFontFamilyValue", () => {
  test("指定順のままカンマ区切りにする", () => {
    expect(toFontFamilyValue(["JetBrains Mono", "Consolas", "monospace"])).toBe(
      '"JetBrains Mono", Consolas, monospace',
    );
  });

  test("不正な名前だけを除いて残りは活かす", () => {
    expect(toFontFamilyValue(["Inter", "bad}name", "Roboto"])).toBe("Inter, Roboto");
  });
});

describe("buildFontCss", () => {
  test("指定したフォントを既定スタックの手前に差し込む", () => {
    const css = buildFontCss({ body: ["Inter"], code: ["JetBrains Mono"] });
    expect(css).toBe(
      ":root {\n" +
        "  --font-sans: Inter, var(--mdecho-default-font-body);\n" +
        '  --font-mono: "JetBrains Mono", var(--mdecho-default-font-code);\n' +
        "}",
    );
  });

  test("片方だけの指定ならもう片方は既定のままにする", () => {
    const css = buildFontCss({ body: [], code: ["Monaspace Neon"] });
    expect(css).not.toContain("--font-sans");
    expect(css).toContain('--font-mono: "Monaspace Neon", var(--mdecho-default-font-code);');
  });

  test("指定が無ければ空文字を返す", () => {
    expect(buildFontCss({ body: [], code: [] })).toBe("");
  });

  test("不正な名前しか無い場合も空文字を返す", () => {
    expect(buildFontCss({ body: ["{}"], code: [] })).toBe("");
  });
});
