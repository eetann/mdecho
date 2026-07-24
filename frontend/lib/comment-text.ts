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
