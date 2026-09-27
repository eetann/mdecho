import { access } from "node:fs/promises";
import { cli, define } from "gunshi";
import { renderHeader } from "gunshi/renderer";
import { AGENT_HINT } from "./agent-hint.ts";
import { docsCommand } from "./cli/docs-command.ts";
import { fontLsCommand } from "./cli/font-command.ts";
import { loadMdechoConfig } from "./config/load.ts";
import { defaultConfigFile } from "./config/save.ts";
import { startServer } from "./server/start.ts";
import { openBrowser } from "./system/open-browser.ts";

const command = define({
  name: "mdecho",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
  examples: `# 基本的な使い方
$ mdecho -f review.md

# ブラウザを自動で開かない
$ mdecho -f review.md --no-open

# 句点ごとの改行をやめる(設定ファイルでも指定できる)
$ mdecho -f review.md --no-split-sentences

# ${AGENT_HINT}
$ mdecho docs list`,
  args: {
    file: {
      type: "string",
      short: "f",
      required: true,
      description: "表示するMarkdownファイルのパス",
    },
    open: {
      type: "boolean",
      default: true,
      negatable: true,
      description: "起動後にブラウザを自動で開く(--no-openで無効化)",
    },
    splitSentences: {
      type: "boolean",
      negatable: true,
      toKebab: true,
      description:
        "句点(。)ごとに表示上の改行を入れる(既定: 有効。設定ファイルのlineBreak.splitSentencesより優先)",
    },
    singleNewline: {
      type: "boolean",
      negatable: true,
      toKebab: true,
      description:
        "単一改行(Enterキー1回)をそのまま表示上の改行にする(既定: 有効。設定ファイルのlineBreak.singleNewlineより優先)",
    },
  },
  run: async (ctx) => {
    const { file, open, splitSentences, singleNewline } = ctx.values;

    try {
      await access(file);
    } catch {
      console.error(`ファイルが見つかりません: ${file}`);
      console.error(AGENT_HINT);
      process.exit(1);
    }

    const loaded = await loadMdechoConfig();
    const { config } = loaded;
    // 設定ファイルがまだ無い場合も、モーダルから保存できるよう既定の保存先を渡す。
    const configFile = loaded.configFile ?? defaultConfigFile();
    if (loaded.configFile) {
      console.log(`Loaded config from ${loaded.configFile}`);
    }

    const { url, close } = await startServer(file, {
      onAllTabsClosed: () => {
        console.log("すべてのタブが閉じられたため終了します");
        process.exit(0);
      },
      config,
      // 未指定の項目はundefinedのまま渡し、設定ファイルの値を使わせる。
      lineBreakOverride: { splitSentences, singleNewline },
      configFile,
    });
    console.log(`Listening on ${url}`);

    if (open) {
      await openBrowser(url);
    }

    const shutdown = async () => {
      await close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  },
});

await cli(process.argv.slice(2), command, {
  name: "mdecho",
  version: "0.0.1",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
  subCommands: { docs: docsCommand, "font-ls": fontLsCommand },
  // font-lsの出力はgrepなどに流す前提なので、ヘッダーでstdoutを汚さない。
  renderHeader: async (ctx) => (ctx.name === fontLsCommand.name ? "" : await renderHeader(ctx)),
  fallbackToEntry: true,
});
