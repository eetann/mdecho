import { type HttpBindings, serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { watch } from "chokidar";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { AGENT_HINT_TROUBLESHOOTING } from "../agent-hint.ts";
import { DEFAULT_CONFIG, type LineBreakConfig, type MdechoConfig } from "../config/defaults.ts";
import { normalizeConfig, resolveLineBreak } from "../config/load.ts";
import { defaultConfigFile, isWritableConfigFile, saveConfig } from "../config/save.ts";
import { extractTitle, renderCommentMarkdown, renderMarkdown } from "../markdown/render.ts";
import { PACKAGE_ROOT } from "../package-root.ts";
import { buildFontCss } from "../styles/font.ts";
import { buildLayoutCss } from "../styles/layout.ts";
import { buildThemeCss } from "../styles/theme.ts";
import { listSystemFonts } from "../system/fonts.ts";
import { isMarkdownPath, isRealPathWithinDir, resolveDoc } from "./doc-path.ts";
import { createLiveReloadHub } from "./live-reload.ts";
import { renderNotFoundPage, renderShell } from "./shell.ts";
import { resolveServableAsset, STATIC_ASSET_HEADERS } from "./static-asset.ts";

const CLIENT_TEMPLATE_PATH = join(PACKAGE_ROOT, "dist", "client", "index.html");

/** 設定から組み立てる、<head>の末尾に差し込むCSS。styles.cssの既定値を上書きする。 */
function buildHeadCss(config: MdechoConfig): string {
  return [buildFontCss(config.font), buildLayoutCss(config.layout), buildThemeCss(config.theme)]
    .filter((css) => css.length > 0)
    .join("\n");
}

export interface StartServerResult {
  server: ServerType;
  url: string;
  close: () => Promise<void>;
}

export interface StartServerOptions {
  /** ブラウザの全タブが閉じられ、サーバーを閉じ終えた後に呼ばれる */
  onAllTabsClosed?: () => void;
  /** グローバル設定(~/.config/mdecho/config.jsonc)の内容 */
  config?: MdechoConfig;
  /**
   * CLIフラグによる改行設定の上書き。指定した項目は設定ファイルより優先され、
   * 設定モーダルから保存してもこの起動中は変わらない。
   */
  lineBreakOverride?: Partial<LineBreakConfig>;
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
    config = DEFAULT_CONFIG,
    lineBreakOverride = {},
    configFile = defaultConfigFile(),
  } = options;
  // 設定モーダルからの保存で変わるため、リクエストごとではなく保存時に組み立て直す。
  let currentConfig = config;
  let headCss = buildHeadCss(currentConfig);
  const configEditable = isWritableConfigFile(configFile);

  // `-f`で指定したファイル。`/`へのリクエストと、ホームへ戻る導線の行き先になる。
  const entryDoc = resolveDoc(filePath, "/");
  if (!entryDoc) {
    throw new Error(`ファイルのパスを解決できません: ${filePath}\n${AGENT_HINT_TROUBLESHOOTING}`);
  }

  // 配信して良いファイルの範囲。`-f`で指定したファイルのあるディレクトリの配下だけを見る。
  const baseDir = dirname(resolve(filePath));

  const liveReload = createLiveReloadHub({
    onIdle: () => {
      void close().then(() => onAllTabsClosed?.());
    },
    onWatchTargetsChange: (paths) => syncWatchTargets(paths),
  });

  const app = new Hono<{ Bindings: HttpBindings }>();

  app.get("/events", (c) => {
    // タブごとに違うMarkdownを開けるため、そのタブが見ているファイルだけを監視対象にする。
    const doc = resolveDoc(filePath, c.req.query("path") ?? "/");
    return liveReload.handleEvents(c, doc?.absPath ?? entryDoc.absPath);
  });

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
      await saveConfig(configFile, normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ message: `設定の保存に失敗しました: ${message}` }, 500);
    }

    // 以降のページ読み込みで新しい設定が当たるようにする。
    // ただしlineBreakOverrideはCLIで明示された指定なので、保存後も優先し続ける。
    currentConfig = normalized;
    headCss = buildHeadCss(currentConfig);
    return c.json({
      font: normalized.font,
      lineBreak: normalized.lineBreak,
      layout: normalized.layout,
      theme: normalized.theme,
      warnings,
    });
  });

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

  // `./foo.md`のようなドキュメントへのリンクも、同じサーバーでレンダリングして返す。
  // 静的ファイル配信より前に置かないと、.mdがoctet-streamとしてダウンロードされてしまう。
  app.get("*", async (c, next) => {
    const doc = resolveDoc(filePath, c.req.path);
    if (!doc) {
      return next();
    }
    // `-f`で渡されたファイル自体は拡張子に関わらず扱う(`-f notes.txt`のようなケース)。
    // ユーザーが明示的に指定したファイルなので、ディレクトリ外を指すsymlinkでも開く。
    if (doc.absPath !== entryDoc.absPath) {
      if (!isMarkdownPath(doc.relPath)) {
        return next();
      }
      // ディレクトリの中に置かれた、外を指すsymlink(`link.md -> /etc/passwd`)は
      // resolveDocの境界チェックを通り抜けるため、読む直前に実体で確かめ直す。
      if (!(await isRealPathWithinDir(baseDir, doc.absPath))) {
        return next();
      }
    }

    const source = await readFile(doc.absPath, "utf-8").catch(() => undefined);
    if (source === undefined) {
      return next();
    }

    try {
      const bodyHtml = await renderMarkdown(
        source,
        resolveLineBreak(currentConfig.lineBreak, lineBreakOverride),
      );
      const title = extractTitle(source) ?? basename(doc.absPath, extname(doc.absPath));
      const html = renderShell(clientTemplate, {
        title,
        bodyHtml,
        filePath: doc.displayPath,
        relPath: doc.relPath,
        entryRelPath: entryDoc.relPath,
        headCss,
        settings: {
          font: currentConfig.font,
          lineBreak: currentConfig.lineBreak,
          lineBreakOverride,
          layout: currentConfig.layout,
          theme: currentConfig.theme,
          configFile,
          editable: configEditable,
        },
      });
      return c.html(html);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.text(`Failed to render markdown: ${message}`, 500);
    }
  });

  // Markdown中の相対パス画像(![alt](./foo.png)など)を配信するため、
  // Markdownファイルと同じディレクトリを静的ファイルルートとして公開する。
  // ただし丸ごと公開すると.envやid_rsaまで読めてしまうため、resolveServableAssetを通して
  // 画像の拡張子だけに絞り、symlinkでディレクトリ外へ出ていないかも確かめてから配信する。
  const serveAsset = serveStatic({ root: baseDir });
  app.use("*", async (c, next) => {
    if ((await resolveServableAsset(filePath, c.req.path)) === undefined) {
      return next();
    }
    // c.body()を組み立てるより前に積んでおく必要があるため、serveStaticのonFoundではなくここで付ける。
    for (const [name, value] of Object.entries(STATIC_ASSET_HEADERS)) {
      c.header(name, value);
    }
    return serveAsset(c, next);
  });

  app.all("*", (c) => c.html(renderNotFoundPage(c.req.path, entryDoc.relPath), 404));

  let closed = false;
  const watchedPaths = new Set<string>([entryDoc.absPath]);
  const watcher = watch(entryDoc.absPath, { ignoreInitial: true });
  watcher.on("change", (path) => liveReload.notifyChange(path));
  watcher.on("add", (path) => liveReload.notifyChange(path));
  watcher.on("error", (error) => {
    console.error("[mdecho] watch error:", error);
  });

  /** 開かれているタブが見ているファイルへ、監視対象を追従させる */
  const syncWatchTargets = (paths: Set<string>) => {
    if (closed) return;
    // エントリのファイルは、タブを開く前の変更も拾えるよう常に監視し続ける。
    const wanted = new Set(paths).add(entryDoc.absPath);
    for (const path of watchedPaths) {
      if (wanted.has(path)) continue;
      watcher.unwatch(path);
      watchedPaths.delete(path);
    }
    for (const path of wanted) {
      if (watchedPaths.has(path)) continue;
      watcher.add(path);
      watchedPaths.add(path);
    }
  };

  const close = async () => {
    closed = true;
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
