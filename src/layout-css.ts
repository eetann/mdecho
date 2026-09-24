/** 本文の見え方(幅・文字サイズ・行間)に関わる設定。 */
export interface LayoutConfig {
  /** 本文の最大幅(px)。画面がこれより広いときは左右に均等な余白が付く */
  contentWidth: number;
  /** 本文の文字サイズ(px)。見出しやコードはこれを基準にした比率で決まる */
  fontSize: number;
  /** 本文の行の高さ(文字サイズに対する倍率) */
  lineHeight: number;
}

/**
 * 設定できる本文幅の範囲(px)。狭すぎると表やコードブロックが潰れ、
 * 広すぎると1行が長くなって読めなくなるため、両端で頭打ちにする。
 */
export const CONTENT_WIDTH_MIN = 480;
export const CONTENT_WIDTH_MAX = 2400;

/**
 * 設定できる文字サイズの範囲(px)。12pxを下回ると漢字の画数が潰れて読めなくなり、
 * 32pxを超えると既定の本文幅に収まる文字数が減りすぎるため、両端で頭打ちにする。
 */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 32;

/**
 * 設定できる行の高さの範囲(倍)。CJKの文字はem boxをほぼ埋めるので1.2を下回ると
 * 行同士がくっつき、逆に広げすぎると段落の切れ目(pのmargin-bottomは1em固定で
 * 行送りと一緒には伸びない)が行間に埋もれるため、両端で頭打ちにする。
 */
export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.4;

/** styles.cssが持つ既定値と揃える。 */
export const DEFAULT_CONTENT_WIDTH = 1024;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_LINE_HEIGHT = 1.75;

/** 本文の見え方を渡すCSS変数。styles.cssの既定値を上書きする。 */
export const CONTENT_WIDTH_VARIABLE = "--mdecho-content-width";
export const FONT_SIZE_VARIABLE = "--mdecho-font-size";
export const LINE_HEIGHT_VARIABLE = "--mdecho-line-height";

/** 設定ファイルにもUIにも極端な値が入りうるため、CSSへ出す前に必ず範囲へ収める。 */
export function clampContentWidth(value: number): number {
  return Math.min(Math.max(Math.round(value), CONTENT_WIDTH_MIN), CONTENT_WIDTH_MAX);
}

export function clampFontSize(value: number): number {
  return Math.min(Math.max(Math.round(value), FONT_SIZE_MIN), FONT_SIZE_MAX);
}

export function clampLineHeight(value: number): number {
  const clamped = Math.min(Math.max(value, LINE_HEIGHT_MIN), LINE_HEIGHT_MAX);
  // 倍率なので整数に丸めるわけにいかないが、1.7500000000000002のような二進小数の
  // 端数がそのまま設定ファイルやCSSへ出ないよう、小数2桁で切る。
  return Math.round(clamped * 100) / 100;
}

/** CSS変数へ入れる値。設定モーダルのライブプレビューとサーバーで共有する。 */
export function buildContentWidthValue(contentWidth: number): string {
  return `${clampContentWidth(contentWidth)}px`;
}

export function buildFontSizeValue(fontSize: number): string {
  return `${clampFontSize(fontSize)}px`;
}

export function buildLineHeightValue(lineHeight: number): string {
  return String(clampLineHeight(lineHeight));
}

/**
 * 本文の見え方の指定を、styles.cssの既定値を上書きするCSSへ組み立てる。
 * 既定のままの項目は書き出さず、全部が既定なら空文字を返して
 * <head>への注入自体を行わない。
 */
export function buildLayoutCss(layout: LayoutConfig): string {
  const declarations: string[] = [];
  if (clampContentWidth(layout.contentWidth) !== DEFAULT_CONTENT_WIDTH) {
    declarations.push(
      `  ${CONTENT_WIDTH_VARIABLE}: ${buildContentWidthValue(layout.contentWidth)};`,
    );
  }
  if (clampFontSize(layout.fontSize) !== DEFAULT_FONT_SIZE) {
    declarations.push(`  ${FONT_SIZE_VARIABLE}: ${buildFontSizeValue(layout.fontSize)};`);
  }
  if (clampLineHeight(layout.lineHeight) !== DEFAULT_LINE_HEIGHT) {
    declarations.push(`  ${LINE_HEIGHT_VARIABLE}: ${buildLineHeightValue(layout.lineHeight)};`);
  }
  if (declarations.length === 0) {
    return "";
  }
  return `:root {\n${declarations.join("\n")}\n}`;
}
