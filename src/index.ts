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
  },
  run: async (ctx) => {
    const { file } = ctx.values;

    try {
      await access(file);
    } catch {
      console.error(`ファイルが見つかりません: ${file}`);
      process.exit(1);
    }

    const { url } = await startServer(file);
    console.log(`Listening on ${url}`);
    await openBrowser(url);
  },
});

await cli(process.argv.slice(2), command, {
  name: "mdecho",
  version: "0.0.1",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
});
