import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { git } from "./exec.ts";

/** 変更後のファイルでの行範囲(1始まり、両端を含む) */
export interface LineRange {
  start: number;
  end: number;
}

/**
 * baseから見たファイルの変わり方。
 * added: baseに無かった(untrackedを含む)、modified: 中身が変わった、unchanged: 変わっていない
 */
export type FileChangeStatus = "added" | "modified" | "unchanged";

/** ファイル一覧やバナーに出す、ファイル単位の変更の要約 */
export interface FileChange {
  status: FileChangeStatus;
  /** 追加された行数(変更された行も追加として数える) */
  added: number;
  /** 削除された行数(変更された行も削除として数える) */
  deleted: number;
}

export interface FileDiff extends FileChange {
  /** 変更後のファイルで追加・変更された行範囲。新規ファイルなら全行 */
  ranges: LineRange[];
}

// `@@ -12,3 +12,5 @@`の`+12,5`の部分。件数が1のときは`,5`が省略される。
const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** `git diff -U0`の出力から、変更後のファイルで追加・変更された行範囲と行数を取り出す */
export function parseDiff(diff: string): FileDiff {
  const ranges: LineRange[] = [];
  let isNew = false;
  let inHunk = false;
  let added = 0;
  let deleted = 0;
  for (const line of diff.split("\n")) {
    const match = HUNK_HEADER_PATTERN.exec(line);
    if (match) {
      inHunk = true;
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      // 件数0は削除だけのhunk。変更後のファイルには対応する行が無い。
      if (count > 0) ranges.push({ start, end: start + count - 1 });
      continue;
    }
    // hunkより前はヘッダー。`--- a/...`や`+++ b/...`を行数に数えないようにする。
    if (!inHunk) {
      if (line === "--- /dev/null") isNew = true;
      continue;
    }
    if (line.startsWith("+")) added += 1;
    else if (line.startsWith("-")) deleted += 1;
  }
  const status: FileChangeStatus = isNew ? "added" : diff.trim() === "" ? "unchanged" : "modified";
  return { status, added, deleted, ranges };
}

/** ファイルの行数。末尾の改行の後ろは行として数えない */
export function countLines(content: string): number {
  if (content === "") return 0;
  const lines = content.split("\n");
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

/**
 * `<base>`とHEADのmerge-baseから作業ツリーまでに、absPathがどう変わったかを返す。
 * listChangedMarkdownと同じ基準で比べる。untrackedのファイルは、まるごと追加されたものとして扱う。
 */
export async function diffFile(base: string, absPath: string): Promise<FileDiff> {
  const cwd = dirname(absPath);
  const mergeBase = (await git(["merge-base", base, "HEAD"], cwd)).trim();
  // 外部diffツールやtextconvの設定に左右されないよう、素のunified diffを出させる。
  const diff = await git(
    ["diff", "-U0", "--no-color", "--no-ext-diff", "--no-textconv", mergeBase, "--", absPath],
    cwd,
  );
  const parsed = parseDiff(diff);
  if (parsed.status !== "unchanged") return parsed;

  // untrackedのファイルはgit diffに出てこないので、indexに無ければ新規とみなす。
  const tracked = await git(["ls-files", "--", absPath], cwd);
  if (tracked.trim() !== "") return parsed;
  const lineCount = countLines(await readFile(absPath, "utf-8"));
  return {
    status: "added",
    added: lineCount,
    deleted: 0,
    ranges: lineCount === 0 ? [] : [{ start: 1, end: lineCount }],
  };
}
