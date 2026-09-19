/** CSSのfont-familyで引用符を付けずに書く必要がある汎用ファミリー/システムキーワード。 */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

/** 引用符なしでもCSSのidentとして解釈できるフォント名(例: Roboto, -apple-system)。 */
const IDENT_PATTERN = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * CSSやHTMLの構文を壊しうる文字。設定ファイルは手書きされる前提なので、
 * エスケープして通すのではなく、含まれていたらそのフォント名ごと読み飛ばす。
 */
const UNSAFE_PATTERN = /[<>{}();"'\\]/;

function hasControlCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export interface FontFamilies {
  /** 本文(コードブロック以外)のフォント。前から順に試される */
  body: string[];
  /** コードブロック・インラインコードのフォント。前から順に試される */
  code: string[];
}

/** フォント名を、CSSのfont-familyに1つ書けるトークンへ変換する。不正な名前はundefined。 */
export function toFontFamilyToken(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0 || UNSAFE_PATTERN.test(trimmed) || hasControlCharacter(trimmed)) {
    return undefined;
  }
  if (GENERIC_FAMILIES.has(trimmed.toLowerCase()) || IDENT_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return `"${trimmed}"`;
}

/** フォント名の配列を、CSSのfont-familyの値(カンマ区切り)へ変換する。 */
export function toFontFamilyValue(fonts: readonly string[]): string {
  return fonts
    .map((font) => toFontFamilyToken(font))
    .filter((token): token is string => token !== undefined)
    .join(", ");
}

/**
 * ユーザー指定のフォントを、styles.cssが持つ既定スタックの手前に差し込むCSSを組み立てる。
 * 未指定なら空文字を返し、その場合<head>への注入自体を行わない。
 */
export function buildFontCss(fonts: FontFamilies): string {
  const declarations: string[] = [];
  const body = toFontFamilyValue(fonts.body);
  if (body.length > 0) {
    declarations.push(`  --font-sans: ${body}, var(--mdecho-default-font-body);`);
  }
  const code = toFontFamilyValue(fonts.code);
  if (code.length > 0) {
    declarations.push(`  --font-mono: ${code}, var(--mdecho-default-font-code);`);
  }
  if (declarations.length === 0) {
    return "";
  }
  return `:root {\n${declarations.join("\n")}\n}`;
}
