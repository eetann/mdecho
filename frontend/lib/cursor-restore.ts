/**
 * targetLines が空の場合は -1 を返す (呼び出し側はカーソル対象が無いものとして扱う)。
 */
export function findRestoreIndex(targetLines: number[], storedLine: number | null): number {
  if (targetLines.length === 0) return -1;
  if (storedLine === null || Number.isNaN(storedLine)) return 0;
  const idx = targetLines.findIndex((line) => line >= storedLine);
  return idx === -1 ? targetLines.length - 1 : idx;
}
