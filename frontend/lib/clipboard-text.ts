export interface ClipboardComment {
  startLine: number;
  endLine: number;
  text: string;
}

export interface CommentGroup {
  /** `-f`に渡したパスと同じ書き方で表した、そのファイルのパス */
  filePath: string;
  comments: Iterable<ClipboardComment>;
}

/**
 * AIエージェントへ渡す参照付きのテキストを組み立てる。
 * リンクを辿った先のコメントもまとめて渡せるよう、ファイルごとのグループを受け取る。
 * ファイルの並びは呼び出し側の順序をそのまま使い、各ファイルの中だけ行番号順にする。
 */
export function buildClipboardText(groups: Iterable<CommentGroup>): string {
  const blocks: string[] = [];
  for (const { filePath, comments } of groups) {
    const sorted = Array.from(comments).sort((a, b) => a.startLine - b.startLine);
    for (const { startLine, endLine, text } of sorted) {
      const ref = startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
      blocks.push(`${filePath}:${ref}\n${text}`);
    }
  }
  return blocks.join("\n\n---\n\n");
}
