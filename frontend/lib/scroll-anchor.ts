/**
 * リロードをまたいで「読んでいた位置」に戻すための、スクロール位置の表し方。
 *
 * window.scrollYのピクセル値をそのまま覚えると、ライブリロードの発端であるファイルの
 * 書き換えで上の方の行が増減したときに、読んでいた場所からそのぶんズレる。
 * 画面に見えている先頭の要素を基準にして、そこからのズレ幅だけをピクセルで持つ。
 */
export interface ScrollAnchor {
  /** 基準にした要素のdata-line */
  line: number;
  /** 同じdata-lineを持つ要素の中で何番目か(句点分割された文があるため) */
  part: number;
  /** 基準線から見た要素の上端の位置(px)。基準線より上にはみ出していれば負 */
  offset: number;
}

export function formatScrollAnchor({ line, part, offset }: ScrollAnchor): string {
  return `${line}:${part}:${Math.round(offset)}`;
}

export function parseScrollAnchor(raw: string | null): ScrollAnchor | null {
  if (raw === null) return null;
  const [linePart, partPart, offsetPart] = raw.split(":");
  const line = Number(linePart);
  const part = Number(partPart);
  const offset = Number(offsetPart);
  if (!Number.isFinite(line) || !Number.isFinite(part) || !Number.isFinite(offset)) {
    return null;
  }
  return { line, part, offset };
}

/**
 * 基準線(threshold)より上から始まっている要素のうち、いちばん下のindexを返す。
 * = 画面に見えている先頭の要素。topsは各要素の上端のビューポート座標(px)で、文書順に並ぶ。
 *
 * 要素が無ければ-1。どれも基準線より下にある(ページの先頭を見ている)ときは0を返し、
 * 基準線の手前にある前書きなどを読んでいる間も先頭の要素を基準にし続ける。
 */
export function findAnchorIndex(tops: readonly number[], threshold: number): number {
  if (tops.length === 0) return -1;

  let anchor = -1;
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i];
    if (top === undefined || top > threshold) continue;
    anchor = i;
  }
  return anchor === -1 ? 0 : anchor;
}
