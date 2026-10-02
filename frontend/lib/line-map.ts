// 共通の先頭・末尾を除いた残りがこの大きさを超えたら、LCSを取らずに全部変更扱いにする。
// 大きな書き換えでブラウザを固めないための上限で、超えたときはコメントがoutdatedに倒れるだけ。
const MAX_LCS_CELLS = 4_000_000;

/**
 * 旧テキストの各行が、新テキストの何行目にそのまま残っているかを返す(どちらも0始まり)。
 * 削除された行や書き換えられた行はnullになる。
 */
export function mapLines(
  oldLines: readonly string[],
  newLines: readonly string[],
): (number | null)[] {
  const result: (number | null)[] = Array.from({ length: oldLines.length }, () => null);

  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    result[prefix] = prefix;
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    result[oldLines.length - 1 - suffix] = newLines.length - 1 - suffix;
    suffix++;
  }

  const n = oldLines.length - prefix - suffix;
  const m = newLines.length - prefix - suffix;
  if (n === 0 || m === 0 || n * m > MAX_LCS_CELLS) return result;

  // table[i][j]: 旧の中間部i行目以降と新の中間部j行目以降のLCS長
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        oldLines[prefix + i] === newLines[prefix + j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[prefix + i] === newLines[prefix + j]) {
      result[prefix + i] = prefix + j;
      i++;
      j++;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      i++;
    } else {
      j++;
    }
  }
  return result;
}
