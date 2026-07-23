import { pageStyles } from "./page-styles.ts";

export interface PageTemplateOptions {
  title: string;
  bodyHtml: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderPage({ title, bodyHtml }: PageTemplateOptions): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${pageStyles}</style>
  </head>
  <body>
    <article class="markdown-body">${bodyHtml}</article>
  </body>
</html>
`;
}
