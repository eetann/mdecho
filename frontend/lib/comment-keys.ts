export function keyOf(startLine: number, endLine: number): string {
  return `${startLine}-${endLine}`;
}

export function parseKey(key: string): { startLine: number; endLine: number } {
  const [startPart, endPart] = key.split("-");
  return { startLine: Number(startPart), endLine: Number(endPart) };
}
