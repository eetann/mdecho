import { watch } from "chokidar";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { basename, extname } from "node:path";
import { renderPage } from "./html-template.ts";
import { createLiveReloadHub } from "./live-reload.ts";
import { renderMarkdown } from "./markdown.ts";

export interface StartServerResult {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export function startServer(filePath: string): Promise<StartServerResult> {
  return new Promise((resolve) => {
    const liveReload = createLiveReloadHub();

    const server = createServer((req, res) => {
      if (liveReload.handleRequest(req, res)) {
        return;
      }

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

    const watcher = watch(filePath, { ignoreInitial: true });
    watcher.on("change", () => liveReload.notifyChange());
    watcher.on("add", () => liveReload.notifyChange());
    watcher.on("error", (error) => {
      console.error("[mdecho] watch error:", error);
    });

    const close = async () => {
      await watcher.close();
      liveReload.closeAll();
      await new Promise<void>((res, rej) => {
        server.close((err) => (err ? rej(err) : res()));
      });
    };

    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://localhost:${port}/`, close });
    });
  });
}
