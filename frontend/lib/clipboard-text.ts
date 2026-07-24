export interface ClipboardComment {
  startLine: number;
  endLine: number;
  text: string;
}

export function buildClipboardText(filePath: string, comments: Iterable<ClipboardComment>): string {
  return Array.from(comments)
    .sort((a, b) => a.startLine - b.startLine)
    .map(({ startLine, endLine, text }) => {
      const ref = startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
      return `${filePath}:${ref}\n${text}`;
    })
    .join("\n\n---\n\n");
}
