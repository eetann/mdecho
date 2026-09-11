/** 自動配分・手動リサイズのどちらでも、1カラムに許す最小幅(px)。 */
export const MIN_COLUMN_WIDTH = 56;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * カラムごとの自然幅(折り返し無しで必要な幅)から、コンテナ幅に収める配分を決める。
 *
 * 収まらない場合はmax-min公平配分を使う。自然幅が狭いカラムから順に
 * 「均等割り当て枠(残り幅 / 残りカラム数)」と比較し、枠に収まるカラムは自然幅のまま
 * 確定させて余りを広いカラムへ回す。こうすると「型」「必須」のような短いカラムは
 * 詰まったまま残り、「説明」のような長いカラムだけが折り返して縮む。
 */
export function allocateColumnWidths(
  naturalWidths: readonly number[],
  available: number,
  minWidth: number = MIN_COLUMN_WIDTH,
): number[] {
  const count = naturalWidths.length;
  if (count === 0) return [];

  const total = sum(naturalWidths);
  if (total <= 0) {
    return naturalWidths.map(() => Math.max(available / count, minWidth));
  }

  if (total <= available) {
    const extra = available - total;
    return naturalWidths.map((width) => width + (extra * width) / total);
  }

  const ascending = naturalWidths
    .map((width, index) => ({ width, index }))
    .sort((a, b) => a.width - b.width);

  const widths: number[] = Array.from({ length: count }, () => 0);
  let remaining = available;
  let unsettled = count;
  for (const { width, index } of ascending) {
    const share = remaining / unsettled;
    widths[index] = width <= share ? width : Math.max(share, minWidth);
    remaining -= widths[index] as number;
    unsettled -= 1;
  }
  return widths;
}

/**
 * 自然幅の合計がコンテナ幅をどれだけ超えるかで、テーブル本文のフォント倍率を返す。
 * 折り返しが増えて縦に間延びするのを、読みやすさを損なわない範囲で和らげる目的。
 */
export function pickFontScale(naturalTotal: number, available: number): number {
  if (available <= 0 || naturalTotal <= 0) return 1;
  const ratio = naturalTotal / available;
  if (ratio >= 2.4) return 0.85;
  if (ratio >= 1.5) return 0.92;
  return 1;
}
