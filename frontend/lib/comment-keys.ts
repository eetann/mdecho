/** sentenceIndex=0のときは既存フォーマットのまま(旧sessionStorageデータとの互換性を保つ) */
export function keyOf(startLine: number, endLine: number, sentenceIndex = 0): string {
  const base = `${startLine}-${endLine}`;
  return sentenceIndex === 0 ? base : `${base}:${sentenceIndex}`;
}

export function parseKey(key: string): {
  startLine: number;
  endLine: number;
  sentenceIndex: number;
} {
  const [rangePart, sentencePart] = key.split(":");
  const [startPart, endPart] = (rangePart ?? "").split("-");
  return {
    startLine: Number(startPart),
    endLine: Number(endPart),
    sentenceIndex: sentencePart === undefined ? 0 : Number(sentencePart),
  };
}
