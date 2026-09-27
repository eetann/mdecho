import { describe, expect, test } from "bun:test";
import {
  buildThemeBootScript,
  buildThemeCss,
  DEFAULT_THEME,
  isThemeColorValue,
  isThemeMode,
  resolveThemeMode,
  THEME_COLOR_KEYS,
  type ThemeConfig,
} from "./theme.ts";

describe("isThemeMode", () => {
  test("決まった3語だけを受け付ける", () => {
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("Dark")).toBe(false);
    expect(isThemeMode("auto")).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });
});

describe("resolveThemeMode", () => {
  test("systemはOSの設定で決まる", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
  });

  test("固定したモードはOSの設定に左右されない", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });
});

describe("isThemeColorValue", () => {
  test("16進表記を受け付ける", () => {
    for (const value of ["#fff", "#ffff", "#0d1117", "#0d1117cc"]) {
      expect(isThemeColorValue(value)).toBe(true);
    }
  });

  test("桁数の合わない16進は弾く", () => {
    for (const value of ["#ff", "#fffff", "#0d1117c", "#gggggg"]) {
      expect(isThemeColorValue(value)).toBe(false);
    }
  });

  test("キーワードと色関数を受け付ける", () => {
    for (const value of [
      "red",
      "transparent",
      "currentColor",
      "oklch(70% 0.1 250)",
      "rgb(9 105 218 / 0.5)",
      "rgba(9, 105, 218, 0.5)",
      "hsl(212 100% 45%)",
      "color(display-p3 1 0 0)",
    ]) {
      expect(isThemeColorValue(value)).toBe(true);
    }
  });

  test("CSSの他の部分を参照する書き方は通さない", () => {
    for (const value of [
      "var(--color-primary)",
      "color-mix(in oklab, red 50%, blue)",
      "url(evil.png)",
    ]) {
      expect(isThemeColorValue(value)).toBe(false);
    }
  });

  test("宣言やタグを閉じられる値は通さない", () => {
    for (const value of [
      "red; } body { display: none",
      "red}",
      "red;",
      "</style><script>alert(1)</script>",
      "rgb(0,0,0);color:red",
      "",
      "   ",
    ]) {
      expect(isThemeColorValue(value)).toBe(false);
    }
  });
});

describe("buildThemeCss", () => {
  test("上書きが無ければ空文字(注入しない)", () => {
    expect(buildThemeCss(DEFAULT_THEME)).toBe("");
  });

  test("書いた色だけをモードごとのセレクタで出す", () => {
    const theme: ThemeConfig = {
      mode: "system",
      light: { primary: "#1f6feb" },
      dark: { "base-100": "#000000", "base-content": "#f0f6fc" },
    };
    expect(buildThemeCss(theme)).toBe(
      `[data-theme="light"] {
  --color-primary: #1f6feb;
}
[data-theme="dark"] {
  --color-base-100: #000000;
  --color-base-content: #f0f6fc;
}`,
    );
  });

  test("片方のモードだけの指定なら、そのブロックだけを出す", () => {
    const css = buildThemeCss({ mode: "dark", light: {}, dark: { primary: "red" } });
    expect(css).toBe(`[data-theme="dark"] {
  --color-primary: red;
}`);
  });

  test("出力順は書いた順ではなくトークンの定義順にそろえる", () => {
    const css = buildThemeCss({
      mode: "system",
      light: { "error-content": "#fff", "base-100": "#fff", primary: "#000" },
      dark: {},
    });
    const order = [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]);
    expect(order).toEqual(["base-100", "primary", "error-content"]);
  });

  test("daisyUIの色トークンはすべて上書きできる", () => {
    const light = Object.fromEntries(THEME_COLOR_KEYS.map((key) => [key, "#010203"]));
    const css = buildThemeCss({ mode: "system", light, dark: {} });
    for (const key of THEME_COLOR_KEYS) {
      expect(css).toContain(`--color-${key}: #010203;`);
    }
  });
});

describe("buildThemeBootScript", () => {
  test("固定モードはOSを見ずにその値を書く", () => {
    expect(buildThemeBootScript("dark")).toContain('var m="dark"');
    expect(buildThemeBootScript("light")).toContain('var m="light"');
  });

  test("systemはprefers-color-schemeを見る", () => {
    expect(buildThemeBootScript("system")).toContain("prefers-color-scheme: dark");
  });

  test("scriptタグを閉じる文字を含まない", () => {
    for (const mode of ["system", "light", "dark"] as const) {
      expect(buildThemeBootScript(mode)).not.toContain("<");
    }
  });

  test("知らないモードは既定へ寄せる", () => {
    expect(buildThemeBootScript("auto" as never)).toContain('var m="system"');
  });
});
