import { define } from "gunshi";
import { listSystemFonts } from "../system/fonts.ts";

export const fontLsCommand = define({
  name: "font-ls",
  description: "このシステムで使えるフォント名の一覧を表示する",
  examples: `# 一覧を表示
$ mdecho font-ls

# 名前で絞り込む
$ mdecho font-ls | grep -i gothic`,
  run: async () => {
    try {
      const fonts = await listSystemFonts();
      for (const font of fonts) {
        // 設定ファイルに書くのは括弧の前の名前。括弧内は同じフォントを指す別名。
        console.log(
          font.aliases.length > 0 ? `${font.name} (${font.aliases.join(", ")})` : font.name,
        );
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
