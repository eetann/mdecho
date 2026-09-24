export interface AtBottomInput {
  /** 現在のスクロール量(px) */
  scrollY: number;
  /** ビューポートの高さ(px) */
  viewHeight: number;
  /** ページ全体の高さ(px) */
  scrollHeight: number;
}

/** ページの最下部まで到達しているか。そもそもスクロールしないページではfalse */
export function isAtBottom({ scrollY, viewHeight, scrollHeight }: AtBottomInput): boolean {
  // 画面に収まりきるページを「常に最下部」とみなすと、上を見ていても最後の見出しが選ばれる。
  if (scrollHeight <= viewHeight) return false;
  // 端数の切り捨てで最下部でも1px足りないことがあるため、少し余裕を持たせる。
  return scrollY + viewHeight >= scrollHeight - 2;
}

export interface ActiveHeadingInput {
  /** 各見出しの上端のビューポート座標(px)。目次と同じ並び順(=文書順) */
  tops: readonly number[];
  /** この位置より上に来た見出しを「今読んでいる見出し」とみなす境界(px) */
  threshold: number;
  /** ページの最下部まで到達しているか */
  atBottom: boolean;
}

/**
 * 今読んでいる見出しが目次の何番目かを返す。見出しが無ければ-1。
 *
 * 境界より上にある見出しのうち、いちばん下のものを選ぶ。節の中身が画面を覆い尽くして
 * 見出しが1つも画面に見えていない状態でも、直前に通り過ぎた見出しが残る。
 */
export function findActiveHeadingIndex({ tops, threshold, atBottom }: ActiveHeadingInput): number {
  if (tops.length === 0) return -1;
  // 最下部では最後の見出しを選ぶ。末尾の節が短いと、そこを読んでいても見出しが境界まで
  // 上がりきらず、これ以上スクロールできないまま手前の見出しが選ばれ続けてしまう。
  if (atBottom) return tops.length - 1;

  let active = -1;
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i];
    if (top === undefined || top > threshold) continue;
    active = i;
  }
  // 最初の見出しより手前(前書きなど)を読んでいる間は、最初の見出しを選んでおく。
  // どこも光っていない目次は機能していないように見えるため。
  return active === -1 ? 0 : active;
}

/**
 * カーソルがどの見出しの節にいるかを、見出しの並びの中でのindexで返す。カーソルが未設定なら-1。
 * headingPositionsは、見出しがtargetsの何番目かを文書順に並べたもの。
 */
export function findCursorHeadingIndex(
  headingPositions: readonly number[],
  cursorIndex: number,
): number {
  if (headingPositions.length === 0 || cursorIndex < 0) return -1;

  let found = -1;
  for (let i = 0; i < headingPositions.length; i++) {
    const position = headingPositions[i];
    if (position === undefined || position > cursorIndex) break;
    found = i;
  }
  // 最初の見出しより手前(前書きなど)にカーソルがあるときは、findActiveHeadingIndexと
  // 揃えて最初の見出しに寄せる。同じ場所を指しているのに印が2つに割れるのを防ぐ。
  return found === -1 ? 0 : found;
}

export interface RevealInput {
  /** スクロール領域の中での項目の上端(px) */
  itemTop: number;
  /** 項目の高さ(px) */
  itemHeight: number;
  /** 現在のスクロール量(px) */
  scrollTop: number;
  /** スクロール領域の見えている高さ(px) */
  viewHeight: number;
}

/**
 * 目次の中で項目が見えるようにするための、新しいscrollTopを返す。
 * すでに見えていれば現在のscrollTopをそのまま返す(= 動かさない)。
 */
export function scrollTopToReveal({
  itemTop,
  itemHeight,
  scrollTop,
  viewHeight,
}: RevealInput): number {
  if (itemTop < scrollTop) return itemTop;
  const itemBottom = itemTop + itemHeight;
  if (itemBottom > scrollTop + viewHeight) return itemBottom - viewHeight;
  return scrollTop;
}
