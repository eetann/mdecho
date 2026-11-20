import type { ClipboardFormat } from "../../src/config/defaults.ts";

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
 *
 * - grouped: ファイルごとに`## path`の見出しを1回だけ書き、その下に`L12:`とコメントを並べる。
 *   コメントは行番号の次の行から書く(先頭にコードブロックを書いてもそのまま崩れない)
 * - inline: コメントごとに`path:L12`を付け、`---`で区切る
 */
export function buildClipboardText(
  groups: Iterable<CommentGroup>,
  format: ClipboardFormat,
): string {
  const sortedGroups = Array.from(groups, ({ filePath, comments }) => ({
    filePath,
    comments: Array.from(comments).sort((a, b) => a.startLine - b.startLine),
  })).filter((group) => group.comments.length > 0);

  if (format === "grouped") {
    return sortedGroups
      .map(({ filePath, comments }) => {
        const items = comments.map(({ startLine, endLine, text }) => {
          const ref = startLine === endLine ? `L${startLine}` : `L${startLine}-${endLine}`;
          return `${ref}:\n${text}`;
        });
        return [`## ${filePath}`, ...items].join("\n\n");
      })
      .join("\n\n");
  }

  const blocks: string[] = [];
  for (const { filePath, comments } of sortedGroups) {
    for (const { startLine, endLine, text } of comments) {
      const ref = startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
      blocks.push(`${filePath}:${ref}\n${text}`);
    }
  }
  return blocks.join("\n\n---\n\n");
}
