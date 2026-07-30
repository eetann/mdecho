export interface CursorKey {
  line: number;
  part: number;
}

/** partが0のときは従来通りの素の行番号文字列にする(旧sessionStorageデータとの互換性を保つ) */
export function formatCursorKey(line: number, part: number): string {
  return part === 0 ? String(line) : `${line}:${part}`;
}

/** 旧形式(素の行番号文字列)はpart:0として解釈する */
export function parseCursorKey(raw: string | null): CursorKey | null {
  if (raw === null) return null;
  const [linePart, partPart] = raw.split(":");
  const line = Number(linePart);
  if (Number.isNaN(line)) return null;
  const part = partPart === undefined ? 0 : Number(partPart);
  return { line, part: Number.isNaN(part) ? 0 : part };
}

/**
 * targetLines/targetPartsが空の場合は -1 を返す (呼び出し側はカーソル対象が無いものとして扱う)。
 * (line, part)の辞書式順序でstored以上となる最初のindexを返す。
 */
export function findRestoreIndex(
  targetLines: readonly number[],
  targetParts: readonly number[],
  stored: CursorKey | null,
): number {
  if (targetLines.length === 0) return -1;
  if (stored === null || Number.isNaN(stored.line)) return 0;
  const idx = targetLines.findIndex((line, i) => {
    const part = targetParts[i] ?? 0;
    return line > stored.line || (line === stored.line && part >= stored.part);
  });
  return idx === -1 ? targetLines.length - 1 : idx;
}
