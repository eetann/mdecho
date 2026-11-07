import { dirname } from "node:path";
import { git } from "./exec.ts";

/** 変更後のファイルでの行範囲(1始まり、両端を含む) */
export interface LineRange {
  start: number;
  end: number;
}

// `@@ -12,3 +12,5 @@`の`+12,5`の部分。件数が1のときは`,5`が省略される。
const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** `git diff -U0`の出力から、変更後のファイルで追加・変更された行範囲を取り出す */
export function parseChangedLines(diff: string): LineRange[] {
  const ranges: LineRange[] = [];
  for (const line of diff.split("\n")) {
    // ファイルごと新しく増えたなら、全行に印を付けても何も伝わらないので返さない。
    if (line === "--- /dev/null") {
      return [];
    }
    const match = HUNK_HEADER_PATTERN.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    // 件数0は削除だけのhunk。変更後のファイルには対応する行が無い。
    if (count === 0) continue;
    ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}

/**
 * `<base>`とHEADのmerge-baseから作業ツリーまでに、absPathのどの行が追加・変更されたかを返す。
 * listChangedMarkdownと同じ基準で比べる。untrackedや、merge-baseに無かったファイルは空になる。
 */
export async function listChangedLines(base: string, absPath: string): Promise<LineRange[]> {
  const cwd = dirname(absPath);
  const mergeBase = (await git(["merge-base", base, "HEAD"], cwd)).trim();
  // 外部diffツールやtextconvの設定に左右されないよう、素のunified diffを出させる。
  const diff = await git(
    ["diff", "-U0", "--no-color", "--no-ext-diff", "--no-textconv", mergeBase, "--", absPath],
    cwd,
  );
  return parseChangedLines(diff);
}
