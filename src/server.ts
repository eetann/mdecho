import { watch } from "chokidar";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { basename, extname, join } from "node:path";
import { createLiveReloadHub } from "./live-reload.ts";
import { renderCommentMarkdown, renderMarkdown } from "./markdown.ts";
import { renderShell } from "./render-shell.ts";

const CLIENT_TEMPLATE_PATH = join(import.meta.dirname, "..", "dist", "client", "index.html");

export interface StartServerResult {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export interface StartServerOptions {
  /** ブラウザの全タブが閉じられ、サーバーを閉じ終えた後に呼ばれる */
  onAllTabsClosed?: () => void;
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function startServer(
  filePath: string,
  options: StartServerOptions = {},
): Promise<StartServerResult> {
  const clientTemplate = await readFile(CLIENT_TEMPLATE_PATH, "utf-8").catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `dist/client/index.htmlが見つかりません。先に \`bun run build:client\` を実行してください (${message})`,
    );
  });

  const { onAllTabsClosed } = options;
  const liveReload = createLiveReloadHub({
    onIdle: () => {
      void close().then(() => onAllTabsClosed?.());
    },
  });

  const server = createServer((req, res) => {
    if (liveReload.handleRequest(req, res)) {
      return;
    }

    if (req.method === "POST" && req.url === "/api/render-comment") {
      readRequestBody(req)
        .then(async (body) => {
          const { text } = JSON.parse(body) as { text?: unknown };
          const html = await renderCommentMarkdown(typeof text === "string" ? text : "");
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ html }));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Failed to render comment: ${message}`);
        });
      return;
    }

    readFile(filePath, "utf-8")
      .then(async (source) => {
        const bodyHtml = await renderMarkdown(source);
        const title = basename(filePath, extname(filePath));
        const html = renderShell(clientTemplate, { title, bodyHtml, filePath });
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

  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://localhost:${port}/`, close });
    });
  });
}
