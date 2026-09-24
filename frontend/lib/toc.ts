export interface TocSourceEntry {
  tagName: string;
  line: number;
  text: string;
  /** 見出しに振られたid(src/rehype-heading-id.ts)。目次のリンク先になる */
  id: string;
}

export interface TocEntry {
  level: number;
  line: number;
  text: string;
  id: string;
}

const HEADING_PATTERN = /^H([1-6])$/;

/** h1〜h6ならその見出しレベル(1〜6)を、それ以外はnullを返す */
export function headingLevelOf(tagName: string): number | null {
  const match = HEADING_PATTERN.exec(tagName);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

/** targets のうち見出し(h1〜h6)だけを抽出し、レベル付きの目次エントリに変換する。 */
export function buildToc(sourceEntries: TocSourceEntry[]): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const { tagName, line, text, id } of sourceEntries) {
    const level = headingLevelOf(tagName);
    if (level === null) continue;
    entries.push({ level, line, text, id });
  }
  return entries;
}
