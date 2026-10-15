/**
 * リンクの行き先が複数考えられるときに、本文のHTMLへ載せる選択肢の形。
 * サーバー(rehypeプラグイン)が書き、frontend/がクリック時に読む。
 * frontend/から読むため、node依存やunifiedなどを持ち込まないこと。
 */

/** どこを基準に解決したか */
export type LinkBase = "file" | "root";

export interface LinkChoice {
  base: LinkBase;
  /** 配信先のURLのパス(`/docs/a.md`)。`?`や`#`も含めた、そのままhrefに使える形 */
  url: string;
}

/** 選択肢をJSONで載せる`<a>`の属性名 */
export const LINK_CHOICES_ATTRIBUTE = "data-mdecho-link-choices";

export const LINK_BASE_LABELS: Record<LinkBase, string> = {
  file: "このファイル基準",
  root: "プロジェクトルート基準",
};

/** 属性の値を読む。壊れていたり選択肢が2つ未満なら(選ばせる意味が無いので)undefined */
export function parseLinkChoices(value: string | null): LinkChoice[] | undefined {
  if (value === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const choices = parsed.filter(
    (item): item is LinkChoice =>
      typeof item === "object" &&
      item !== null &&
      (item.base === "file" || item.base === "root") &&
      typeof item.url === "string",
  );
  return choices.length >= 2 ? choices : undefined;
}
