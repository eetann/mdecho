/** 配色をライトに固定するか、ダークに固定するか、OSの設定に合わせるか。 */
export const THEME_MODES = ["system", "light", "dark"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** systemを解決したあとの、実際に当てる配色。 */
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "system";

/**
 * 上書きできる色の名前。daisyUIの色トークンをそのまま採用しているので、
 * 設定ファイルのキー名と、当てるCSS変数名(`--color-<キー名>`)が一致する。
 * frontend/styles.cssの2つの@plugin "daisyui/theme"ブロックが既定値を持つ。
 */
export const THEME_COLOR_KEYS = [
  "base-100",
  "base-200",
  "base-300",
  "base-content",
  "primary",
  "primary-content",
  "secondary",
  "secondary-content",
  "accent",
  "accent-content",
  "neutral",
  "neutral-content",
  "info",
  "info-content",
  "success",
  "success-content",
  "warning",
  "warning-content",
  "error",
  "error-content",
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/** 書かれた色だけを持つ。書かなかったトークンはstyles.cssの既定値のまま。 */
export type ThemeColors = Partial<Record<ThemeColorKey, string>>;

export interface ThemeConfig {
  mode: ThemeMode;
  /** ライトモードのときに上書きする色 */
  light: ThemeColors;
  /** ダークモードのときに上書きする色 */
  dark: ThemeColors;
}

export const DEFAULT_THEME: ThemeConfig = { mode: DEFAULT_THEME_MODE, light: {}, dark: {} };

/**
 * 解決済みの配色を載せる属性。`system`のときもブートスクリプトが解決済みの値を書くため、
 * CSS側はモードごとに1つのセレクタ(`[data-theme="dark"]`)だけを見ればよくなる。
 */
export const THEME_ATTRIBUTE = "data-theme";

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

/** `system`はOSが暗いかどうかで解決する。それ以外はそのまま。 */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

/** `#fff` `#ffffff` `#ffffffcc` などの16進表記。 */
const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** `red` `transparent` `currentColor` などのキーワード。 */
const KEYWORD_PATTERN = /^[a-zA-Z]+$/;

/**
 * `oklch(70% 0.1 250)` `rgb(9 105 218 / 0.5)` などの関数表記。
 * 関数名は明示した色関数だけを許し、中身も色の値に出てくる文字だけに絞る。
 * `var()`や`url()`、`color-mix()`がここを通らないのは意図的で、
 * 設定ファイルの値からCSSの他の部分を参照させないためにこうしている。
 */
const COLOR_FUNCTION_PATTERN =
  /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([0-9a-zA-Z.%,/ +-]*\)$/;

/**
 * 設定ファイルの値をCSSへ出してよいか判定する。
 * src/font-css.tsと同じ方針で、危ない値はエスケープして通すのではなく弾いて知らせる。
 */
export function isThemeColorValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return (
    HEX_PATTERN.test(trimmed) ||
    KEYWORD_PATTERN.test(trimmed) ||
    COLOR_FUNCTION_PATTERN.test(trimmed)
  );
}

function buildColorBlock(resolved: ResolvedTheme, colors: ThemeColors): string {
  const declarations: string[] = [];
  // 出力順を安定させるため、オブジェクトの並びではなくトークンの定義順で回す。
  for (const key of THEME_COLOR_KEYS) {
    const value = colors[key];
    if (value === undefined) {
      continue;
    }
    declarations.push(`  --color-${key}: ${value.trim()};`);
  }
  if (declarations.length === 0) {
    return "";
  }
  return `[${THEME_ATTRIBUTE}="${resolved}"] {\n${declarations.join("\n")}\n}`;
}

/**
 * ユーザーが指定した色を、styles.cssのテーマ定義を上書きするCSSへ組み立てる。
 * 注入先の<style>はCSSレイヤーの外にあるため、@layer baseにいるdaisyUIの
 * テーマ定義より必ず強く当たる(src/font-css.tsの上書きと同じ仕組み)。
 * 上書きが無ければ空文字を返し、その場合<head>への注入自体を行わない。
 */
export function buildThemeCss(theme: ThemeConfig): string {
  return [buildColorBlock("light", theme.light), buildColorBlock("dark", theme.dark)]
    .filter((block) => block.length > 0)
    .join("\n");
}

/**
 * <head>に差し込む、配色を決めるだけのスクリプト。
 * Reactのバンドルを待つと一瞬ライトで描画されてしまうため、最初の描画より前に
 * html要素へ解決済みの配色を書く。
 */
export function buildThemeBootScript(mode: ThemeMode): string {
  // modeは決まった3語のいずれかなので、そのまま文字列リテラルとして埋めてよい。
  const safeMode: ThemeMode = isThemeMode(mode) ? mode : DEFAULT_THEME_MODE;
  return `(function(){var m=${JSON.stringify(safeMode)};var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},d?"dark":"light")})()`;
}
