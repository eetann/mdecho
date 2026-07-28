export interface TocSourceEntry {
  tagName: string;
  line: number;
  text: string;
}

export interface TocEntry {
  level: number;
  line: number;
  text: string;
}

const HEADING_PATTERN = /^H([1-6])$/;

/** targets のうち見出し(h1〜h6)だけを抽出し、レベル付きの目次エントリに変換する。 */
export function buildToc(sourceEntries: TocSourceEntry[]): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const { tagName, line, text } of sourceEntries) {
    const match = HEADING_PATTERN.exec(tagName);
    if (!match?.[1]) continue;
    entries.push({ level: Number(match[1]), line, text });
  }
  return entries;
}
