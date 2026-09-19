import { type HttpBindings, serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { watch } from "chokidar";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { AGENT_HINT_TROUBLESHOOTING } from "./agent-hint.ts";
import { DEFAULT_CONFIG, type MdechoConfig, normalizeConfig } from "./config.ts";
import { defaultConfigFile, isWritableConfigFile, saveFontConfig } from "./config-writer.ts";
import { buildFontCss } from "./font-css.ts";
import { listSystemFonts } from "./system-fonts.ts";
import { createLiveReloadHub } from "./live-reload.ts";
import { extractTitle, renderCommentMarkdown, renderMarkdown } from "./markdown.ts";
import { renderShell } from "./render-shell.ts";

const CLIENT_TEMPLATE_PATH = join(import.meta.dirname, "..", "dist", "client", "index.html");

export interface StartServerResult {
  server: ServerType;
  url: string;
  close: () => Promise<void>;
}

export interface StartServerOptions {
  /** ブラウザの全タブが閉じられ、サーバーを閉じ終えた後に呼ばれる */
  onAllTabsClosed?: () => void;
  /** 句点(。)ごとに表示上の改行を入れるか(デフォルトtrue) */
  splitSentences?: boolean;
  /** グローバル設定(~/.config/mdecho/config.jsonc)の内容 */
  config?: MdechoConfig;
  /** 設定モーダルからの保存先。未指定なら既定の場所に作る */
  configFile?: string;
}

export async function startServer(
  filePath: string,
  options: StartServerOptions = {},
): Promise<StartServerResult> {
  const clientTemplate = await readFile(CLIENT_TEMPLATE_PATH, "utf-8").catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `dist/client/index.htmlが見つかりません。先に \`bun run build:client\` を実行してください (${message})\n${AGENT_HINT_TROUBLESHOOTING}`,
    );
  });

  const {
    onAllTabsClosed,
    splitSentences = true,
    config = DEFAULT_CONFIG,
    configFile = defaultConfigFile(),
  } = options;
  // 設定モーダルからの保存で変わるため、リクエストごとではなく保存時に組み立て直す。
  let currentConfig = config;
  let headCss = buildFontCss(currentConfig.font);
  const configEditable = isWritableConfigFile(configFile);
  const liveReload = createLiveReloadHub({
    onIdle: () => {
      void close().then(() => onAllTabsClosed?.());
    },
  });

  const app = new Hono<{ Bindings: HttpBindings }>();

  app.get("/events", (c) => liveReload.handleEvents(c));

  app.get("/api/fonts", async (c) => {
    try {
      return c.json({ fonts: await listSystemFonts() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ message }, 500);
    }
  });

  app.post("/api/config", async (c) => {
    if (!configEditable) {
      return c.json({ message: `${configFile} はUIから保存できない形式です` }, 400);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ message: `リクエストを解釈できません: ${message}` }, 400);
    }

    const warnings: string[] = [];
    const normalized = normalizeConfig(body, (warning) => warnings.push(warning));
    try {
      await saveFontConfig(configFile, normalized.font);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ message: `設定の保存に失敗しました: ${message}` }, 500);
    }

    // 以降のページ読み込みで新しいフォントが当たるようにする。
    currentConfig = normalized;
    headCss = buildFontCss(currentConfig.font);
    return c.json({ font: normalized.font, warnings });
  });

  // Markdown中の相対パス画像(![alt](./foo.png)など)を配信するため、
  // Markdownファイルと同じディレクトリを静的ファイルルートとして公開する。
  // 該当ファイルが無ければnext()でmarkdownレンダリングにフォールスルーする。
  const baseDir = dirname(resolve(filePath));
  app.use("*", serveStatic({ root: baseDir }));

  app.post("/api/render-comment", async (c) => {
    let text: unknown;
    try {
      const body = await c.req.json<{ text?: unknown }>();
      text = body.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.text(`Failed to render comment: ${message}`, 400);
    }
    const html = await renderCommentMarkdown(typeof text === "string" ? text : "");
    return c.json({ html });
  });

  app.get("*", async (c) => {
    try {
      const source = await readFile(filePath, "utf-8");
      const bodyHtml = await renderMarkdown(source, { splitSentences });
      const title = extractTitle(source) ?? basename(filePath, extname(filePath));
      const html = renderShell(clientTemplate, {
        title,
        bodyHtml,
        filePath,
        headCss,
        settings: { font: currentConfig.font, configFile, editable: configEditable },
      });
      return c.html(html);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.text(`Failed to render markdown: ${message}`, 500);
    }
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

  const server = await new Promise<ServerType>((resolve) => {
    // 設定を書き換えるAPIを持つため、LANからは触れないようループバックだけで待ち受ける。
    // WSLでもWindows側のブラウザから127.0.0.1で到達できる。
    const s = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { server, url: `http://localhost:${port}/`, close };
}
