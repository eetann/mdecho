import { access } from "node:fs/promises";
import { cli, define } from "gunshi";
import { openBrowser } from "./open-browser.ts";
import { startServer } from "./server.ts";

const command = define({
  name: "mdecho",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
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
  },
  run: async (ctx) => {
    const { file, open } = ctx.values;

    try {
      await access(file);
    } catch {
      console.error(`ファイルが見つかりません: ${file}`);
      process.exit(1);
    }

    const { url, close } = await startServer(file, {
      onAllTabsClosed: () => {
        console.log("すべてのタブが閉じられたため終了します");
        process.exit(0);
      },
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
});
