export function buildInitialCommentText(selectedText: string): string {
  const trimmed = selectedText.replace(/\n+$/, "");
  if (!trimmed.includes("\n")) {
    return `\`${trimmed}\``;
  }
  return `${trimmed
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}\n\n`;
}

/**
 * 書きかけのコメントのcaret位置に引用を差し込む。
 * 複数行の引用(`> `)は行頭にないと引用にならないため、行の途中なら改行を挟む。
 */
export function insertQuote(
  text: string,
  caret: number,
  quote: string,
): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const after = text.slice(caret);
  const needsLineBreak = quote.startsWith(">") && before !== "" && !before.endsWith("\n");
  const inserted = needsLineBreak ? `\n${quote}` : quote;
  return { text: before + inserted + after, caret: before.length + inserted.length };
}
