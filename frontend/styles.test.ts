import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dir, "styles.css"), "utf-8");

/** コメントを外したうえで、入れ子を含まないいちばん内側のブロックだけを取り出す。 */
function innermostBlocks(css: string): { selector: string; body: string }[] {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const blocks: { selector: string; body: string }[] = [];
  for (const match of withoutComments.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    blocks.push({ selector: (match[1] ?? "").trim(), body: match[2] ?? "" });
  }
  return blocks;
}

function declarations(body: string): string[] {
  return body
    .split(";")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Tailwind v4のcolor-mixポリフィルは、1つのルールにつき先頭の1宣言しか
 * @supportsブロックへ複製しない。そのため色を導き出すカスタムプロパティを
 * 1つのルールにまとめて書くと、2つ目以降がmixする前の色で固定されてしまう
 * (例: カーソル行の下地がprimaryのベタ塗りになる)。
 * ビルドしないと気づけない壊れ方なので、書き方のほうをここで縛る。
 */
test("color-mixを使うカスタムプロパティは1ルールにつき1つだけ書く", () => {
  const offenders = innermostBlocks(source)
    .filter((block) => block.body.includes("color-mix("))
    .map((block) => ({ selector: block.selector, count: declarations(block.body).length }))
    .filter((block) => block.count > 1);

  expect(offenders).toEqual([]);
});

test("導出した色はすべてテーマの色トークンから作る", () => {
  for (const block of innermostBlocks(source)) {
    for (const declaration of declarations(block.body)) {
      if (!declaration.startsWith("--mdecho-") || !declaration.includes("color-mix(")) {
        continue;
      }
      // 直接色を書いてしまうと、設定での色の上書きに追従しなくなる。
      expect(declaration).toContain("var(--color-");
    }
  }
});
