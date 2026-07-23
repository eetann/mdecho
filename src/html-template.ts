import { commentClientScript } from "./comment-client.ts";
import { cursorLineClientScript } from "./cursor-line-client.ts";
import { lineNumberClientScript } from "./line-number-client.ts";
import { liveReloadClientScript } from "./live-reload-client.ts";
import { pageStyles } from "./page-styles.ts";

export interface PageTemplateOptions {
  title: string;
  bodyHtml: string;
  filePath: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toInlineJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function renderPage({ title, bodyHtml, filePath }: PageTemplateOptions): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${pageStyles}</style>
  </head>
  <body>
    <div class="mdecho-page">
      <div class="mdecho-toolbar">
        <button id="mdecho-copy-button" type="button" class="mdecho-copy-button" disabled>Copy</button>
      </div>
      <div class="mdecho-content">
        <div class="mdecho-line-number-gutter"></div>
        <article class="markdown-body">${bodyHtml}</article>
      </div>
    </div>
    <script>window.__MDECHO_FILE_PATH__ = ${toInlineJson(filePath)};</script>
    <script>${liveReloadClientScript}</script>
    <script>${cursorLineClientScript}</script>
    <script>${lineNumberClientScript}</script>
    <script>${commentClientScript}</script>
  </body>
</html>
`;
}
