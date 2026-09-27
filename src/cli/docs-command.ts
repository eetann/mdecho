import { define } from "gunshi";
import { listDocs, readDoc } from "./docs-catalog.ts";

const docsListCommand = define({
  name: "list",
  description: "利用可能なドキュメント一覧を表示する",
  run: async () => {
    const entries = await listDocs();
    const maxNameLength = Math.max(...entries.map((entry) => entry.name.length));
    for (const entry of entries) {
      console.log(`${entry.name.padEnd(maxNameLength + 4)}${entry.description}`);
    }
  },
});

const docsShowCommand = define({
  name: "show",
  description: "指定したドキュメントの内容を表示する",
  args: {
    name: {
      type: "positional",
      required: true,
      description: "表示するドキュメントの名前(mdecho docs listで確認できる)",
    },
  },
  run: async (ctx) => {
    const { name } = ctx.values;
    const doc = await readDoc(name);
    if (!doc) {
      const entries = await listDocs();
      console.error(`ドキュメントが見つかりません: ${name}`);
      console.error(`利用可能なドキュメント: ${entries.map((entry) => entry.name).join(", ")}`);
      process.exit(1);
    }
    console.log(doc.body);
  },
});

export const docsCommand = define({
  name: "docs",
  description: "ドキュメントの一覧表示・内容表示",
  subCommands: {
    list: docsListCommand,
    show: docsShowCommand,
  },
  run: () => {
    console.log('利用可能なサブコマンド: "mdecho docs list", "mdecho docs show <name>"');
  },
});
