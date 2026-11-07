import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cli, define } from "gunshi";
import { renderHeader } from "gunshi/renderer";
import { AGENT_HINT } from "./agent-hint.ts";
import { docsCommand } from "./cli/docs-command.ts";
import { fontLsCommand } from "./cli/font-command.ts";
import { loadMdechoConfig } from "./config/load.ts";
import { defaultConfigFile } from "./config/save.ts";
import { listChangedMarkdown } from "./git/changed-markdown.ts";
import { PACKAGE_ROOT } from "./package-root.ts";
import { startServer } from "./server/start.ts";
import { openBrowser } from "./system/open-browser.ts";

const command = define({
  name: "mdecho",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
  examples: `# 基本的な使い方
$ mdecho -f review.md

# 複数のファイルを1つのタブで切り替えながら読む(位置引数ならシェルのglobも使える)
$ mdecho docs/*.md
$ mdecho -f plan.md -f review.md

# AIがたった今書いた(未コミットの)Markdownをまとめて読む。@はgitのHEADの別名
$ mdecho --git @

# PRで変更されたMarkdownをまとめて読む(mainとのmerge-baseから比べる)
$ gh pr checkout 123 && mdecho --git main

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
      multiple: true,
      description: "表示するMarkdownファイルのパス(複数回指定できる)",
    },
    files: {
      type: "positional",
      multiple: true,
      description: "表示するMarkdownファイルのパス。-fと併用でき、-fの後ろに並ぶ",
    },
    git: {
      type: "string",
      description:
        "<base>とHEADのmerge-baseから作業ツリーまでに変更・追加されたMarkdownを開く(untrackedも含む)。未コミットの変更だけなら@、PRならmainのように指定する",
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
    const { file = [], files = [], git, open, splitSentences, singleNewline } = ctx.values;
    const filePaths = [...file, ...files];

    if (git !== undefined) {
      let changed: string[];
      try {
        changed = await listChangedMarkdown(git);
      } catch (error) {
        console.error(`git差分を取得できません: ${(error as Error).message}`);
        process.exit(1);
      }
      if (changed.length === 0) {
        console.error(`${git}からの差分に変更されたMarkdownがありません`);
        process.exit(1);
      }
      // -fや位置引数と併用されたときに同じファイルが2回並ばないようにする。
      const seen = new Set(filePaths.map((path) => resolve(path)));
      filePaths.push(...changed.filter((path) => !seen.has(resolve(path))));
    }

    if (filePaths.length === 0) {
      console.error("表示するファイルを指定してください(例: mdecho -f review.md)");
      console.error(AGENT_HINT);
      process.exit(1);
    }
    const missing = (
      await Promise.all(
        filePaths.map(async (path) =>
          (await access(path).then(
            () => true,
            () => false,
          ))
            ? null
            : path,
        ),
      )
    ).filter((path) => path !== null);
    if (missing.length > 0) {
      for (const path of missing) {
        console.error(`ファイルが見つかりません: ${path}`);
      }
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

    const { url, close } = await startServer(filePaths, {
      onAllTabsClosed: () => {
        console.log("すべてのタブが閉じられたため終了します");
        process.exit(0);
      },
      config,
      // 未指定の項目はundefinedのまま渡し、設定ファイルの値を使わせる。
      lineBreakOverride: { splitSentences, singleNewline },
      configFile,
      gitBase: git,
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

// bumppが書き換えるのはpackage.jsonだけなので、バージョンはそこから読む。
const { version } = JSON.parse(await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8")) as {
  version: string;
};

await cli(process.argv.slice(2), command, {
  name: "mdecho",
  version,
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
  subCommands: { docs: docsCommand, "font-ls": fontLsCommand },
  // font-lsの出力はgrepなどに流す前提なので、ヘッダーでstdoutを汚さない。
  renderHeader: async (ctx) => (ctx.name === fontLsCommand.name ? "" : await renderHeader(ctx)),
  fallbackToEntry: true,
});
