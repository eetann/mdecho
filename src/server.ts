import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { basename, extname } from "node:path";
import { renderPage } from "./html-template.ts";
import { renderMarkdown } from "./markdown.ts";

export function startServer(filePath: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      readFile(filePath, "utf-8")
        .then(async (source) => {
          const bodyHtml = await renderMarkdown(source);
          const title = basename(filePath, extname(filePath));
          const html = renderPage({ title, bodyHtml });
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Failed to render markdown: ${message}`);
        });
    });

    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://localhost:${port}/` });
    });
  });
}
