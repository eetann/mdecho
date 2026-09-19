import type { SystemFont } from "./types.ts";

/** 一度に描画する候補の上限。フォントが数百入っている環境でも重くならないようにする。 */
export const MAX_FONT_CANDIDATES = 100;

export interface FontCandidates {
  fonts: SystemFont[];
  /** 上限を超えて表示しなかった件数 */
  omitted: number;
}

/** 前方一致を先に出すための優先度。小さいほど先。 */
function matchRank(font: SystemFont, query: string): number {
  const name = font.name.toLowerCase();
  if (name.startsWith(query)) {
    return 0;
  }
  const aliases = font.aliases.map((alias) => alias.toLowerCase());
  if (aliases.some((alias) => alias.startsWith(query))) {
    return 1;
  }
  if (name.includes(query)) {
    return 2;
  }
  return aliases.some((alias) => alias.includes(query)) ? 3 : -1;
}

/**
 * 入力文字列でフォント候補を絞り込む。英語名だけでなく別名(日本語名など)にも当てるため、
 * 「メイリオ」と打っても Meiryo が出る。
 */
export function filterFonts(
  fonts: readonly SystemFont[],
  query: string,
  selected: readonly string[],
): FontCandidates {
  const alreadySelected = new Set(selected);
  const candidates = fonts.filter((font) => !alreadySelected.has(font.name));
  const normalized = query.trim().toLowerCase();

  const matched =
    normalized.length === 0
      ? candidates
      : candidates
          .map((font) => ({ font, rank: matchRank(font, normalized) }))
          .filter((entry) => entry.rank >= 0)
          // Array.prototype.sortは安定なので、同じ優先度の中では元の名前順が保たれる
          .sort((a, b) => a.rank - b.rank)
          .map((entry) => entry.font);

  return {
    fonts: matched.slice(0, MAX_FONT_CANDIDATES),
    omitted: Math.max(0, matched.length - MAX_FONT_CANDIDATES),
  };
}
