/**
 * linesはDOM順に並んだdata-line値の配列。同一値が連続または離散して複数回出現しうる
 * (句点分割された文が同じdata-lineを共有するケース)。
 */

/** position番目の要素が、同じline値を持つ要素の中で何番目(0始まり)の出現かを返す */
export function groupIndexAt(lines: readonly number[], position: number): number {
  const line = lines[position];
  if (line === undefined) return 0;
  let count = 0;
  for (let i = 0; i < position; i++) {
    if (lines[i] === line) count++;
  }
  return count;
}

/** 各要素についてgroupIndexAt相当の値をまとめて計算する */
export function computeLineParts(lines: readonly number[]): number[] {
  const counts = new Map<number, number>();
  return lines.map((line) => {
    const count = counts.get(line) ?? 0;
    counts.set(line, count + 1);
    return count;
  });
}

/**
 * line値がgroupIndex番目に出現するlines内のindexを返す。
 * 該当groupIndexが存在しない場合はそのline値の先頭出現位置にフォールバックする。
 * line値自体が存在しない場合はnullを返す。
 */
export function positionOfGroupIndex(
  lines: readonly number[],
  line: number,
  groupIndex: number,
): number | null {
  let firstPosition: number | null = null;
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== line) continue;
    if (firstPosition === null) firstPosition = i;
    if (count === groupIndex) return i;
    count++;
  }
  return firstPosition;
}
