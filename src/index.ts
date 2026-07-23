import { cli, define } from "gunshi";

const command = define({
  name: "mdecho",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
  args: {
    file: {
      type: "positional",
      description: "表示するMarkdownファイルのパス",
    },
  },
  run: (ctx) => {
    console.log(`file: ${ctx.values.file}`);
  },
});

await cli(Bun.argv.slice(2), command, {
  name: "mdecho",
  version: "0.0.1",
  description: "AIが生成したMarkdownを、人間がレビューしやすくするためのCLIツール",
});
