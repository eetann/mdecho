/** 本文の見え方(幅)に関わる設定。 */
export interface LayoutConfig {
  /** 本文の最大幅(px)。画面がこれより広いときは左右に均等な余白が付く */
  contentWidth: number;
}

/**
 * 設定できる本文幅の範囲(px)。狭すぎると表やコードブロックが潰れ、
 * 広すぎると1行が長くなって読めなくなるため、両端で頭打ちにする。
 */
export const CONTENT_WIDTH_MIN = 480;
export const CONTENT_WIDTH_MAX = 2400;

/** styles.cssが持つ既定値(64rem)と揃える。 */
export const DEFAULT_CONTENT_WIDTH = 1024;

/** 本文の最大幅を渡すCSS変数。styles.cssの既定値を上書きする。 */
export const CONTENT_WIDTH_VARIABLE = "--mdecho-content-width";

/** 設定ファイルにもUIにも極端な値が入りうるため、CSSへ出す前に必ず範囲へ収める。 */
export function clampContentWidth(value: number): number {
  return Math.min(Math.max(Math.round(value), CONTENT_WIDTH_MIN), CONTENT_WIDTH_MAX);
}

/** CSS変数へ入れる値(px)。設定モーダルのライブプレビューとサーバーで共有する。 */
export function buildContentWidthValue(contentWidth: number): string {
  return `${clampContentWidth(contentWidth)}px`;
}

/**
 * 本文幅の指定を、styles.cssの既定値を上書きするCSSへ組み立てる。
 * 既定のままなら空文字を返し、その場合<head>への注入自体を行わない。
 */
export function buildLayoutCss(layout: LayoutConfig): string {
  if (clampContentWidth(layout.contentWidth) === DEFAULT_CONTENT_WIDTH) {
    return "";
  }
  return `:root {\n  ${CONTENT_WIDTH_VARIABLE}: ${buildContentWidthValue(layout.contentWidth)};\n}`;
}
