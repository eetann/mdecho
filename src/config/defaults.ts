/**
 * 設定の形と既定値。設定モーダルの「デフォルトに戻す」で使うため、frontend/からも読む。
 * そのためnode固有のAPIやc12に依存するものはここへ置かないこと
 * (設定ファイルの読み込みはload.ts、書き込みはsave.tsが持つ)。
 */
import type { FontFamilies } from "../styles/font.ts";
import {
  DEFAULT_CONTENT_WIDTH,
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  type LayoutConfig,
} from "../styles/layout.ts";
import { DEFAULT_THEME, type ThemeConfig } from "../styles/theme.ts";

/** 表示上の改行をどこで入れるか。 */
export interface LineBreakConfig {
  /** 句点(。)ごとに表示上の改行を入れる */
  splitSentences: boolean;
  /** 単一改行(Enterキー1回)をそのまま表示上の改行にする */
  singleNewline: boolean;
}

/**
 * 相対リンク・画像の基準をどう決めるか。
 * - `ask`: Markdownファイル基準とプロジェクトルート基準の両方を探す。リンクの行き先が
 *   両方にあるときは、クリックしたときに選ばせる(画像は選べないのでプロジェクトルート基準を優先する)
 * - `file`: Markdownファイルのあるディレクトリ基準だけ(GitHubと同じ)
 * - `root`: プロジェクトルート基準だけ
 */
export const LINK_BASE_MODES = ["ask", "file", "root"] as const;
export type LinkBaseMode = (typeof LINK_BASE_MODES)[number];

export function isLinkBaseMode(value: unknown): value is LinkBaseMode {
  return typeof value === "string" && (LINK_BASE_MODES as readonly string[]).includes(value);
}

export interface LinkConfig {
  base: LinkBaseMode;
}

/**
 * コメントをコピーするときの書き方。
 * - `grouped`: ファイルごとに`## path`の見出しでまとめ、その下に`L12:`とコメントを並べる。
 *   AIへのプロンプトになるため、同じパスを何度も書かずに済むこちらを既定にする
 * - `inline`: コメントごとに`path:L12`を付ける。エディタやAIがそのまま開ける参照になる
 */
export const CLIPBOARD_FORMATS = ["grouped", "inline"] as const;
export type ClipboardFormat = (typeof CLIPBOARD_FORMATS)[number];

export function isClipboardFormat(value: unknown): value is ClipboardFormat {
  return typeof value === "string" && (CLIPBOARD_FORMATS as readonly string[]).includes(value);
}

export interface ClipboardConfig {
  format: ClipboardFormat;
}

export interface MdechoConfig {
  font: FontFamilies;
  lineBreak: LineBreakConfig;
  layout: LayoutConfig;
  theme: ThemeConfig;
  link: LinkConfig;
  clipboard: ClipboardConfig;
}

export const DEFAULT_FONT: FontFamilies = { body: [], code: [] };
export const DEFAULT_LINE_BREAK: LineBreakConfig = { splitSentences: true, singleNewline: true };
export const DEFAULT_LAYOUT: LayoutConfig = {
  contentWidth: DEFAULT_CONTENT_WIDTH,
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: DEFAULT_LINE_HEIGHT,
};
export const DEFAULT_LINK: LinkConfig = { base: "ask" };
export const DEFAULT_CLIPBOARD: ClipboardConfig = { format: "grouped" };
export const DEFAULT_CONFIG: MdechoConfig = {
  font: DEFAULT_FONT,
  lineBreak: DEFAULT_LINE_BREAK,
  layout: DEFAULT_LAYOUT,
  theme: DEFAULT_THEME,
  link: DEFAULT_LINK,
  clipboard: DEFAULT_CLIPBOARD,
};
