import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { countLines, diffFile, parseDiff } from "./changed-lines.ts";

describe("parseDiff", () => {
  test("hunkヘッダーから変更後の行範囲を取り出し、削除だけのhunkは範囲に含めない", () => {
    const diff = [
      "diff --git a/a.md b/a.md",
      "--- a/a.md",
      "+++ b/a.md",
      "@@ -2 +2 @@",
      "-two",
      "+2",
      "@@ -5,0 +6,3 @@ ## 見出し",
      "+a",
      "+b",
      "+c",
      "@@ -10,2 +12,0 @@",
      "-x",
      "-y",
    ].join("\n");

    expect(parseDiff(diff)).toEqual({
      status: "modified",
      added: 4,
      deleted: 3,
      ranges: [
        { start: 2, end: 2 },
        { start: 6, end: 8 },
      ],
    });
  });

  test("新しく追加されたファイルは全行を範囲として返す", () => {
    const diff = ["--- /dev/null", "+++ b/a.md", "@@ -0,0 +1,3 @@", "+1", "+2", "+3"].join("\n");

    expect(parseDiff(diff)).toEqual({
      status: "added",
      added: 3,
      deleted: 0,
      ranges: [{ start: 1, end: 3 }],
    });
  });

  test("ヘッダーの---や+++は行数に数えない", () => {
    const diff = ["--- a/a.md", "+++ b/a.md", "@@ -1 +1 @@", "--- old", "+++ new"].join("\n");

    expect(parseDiff(diff)).toMatchObject({ added: 1, deleted: 1 });
  });

  test("差分が無ければunchanged", () => {
    expect(parseDiff("")).toEqual({ status: "unchanged", added: 0, deleted: 0, ranges: [] });
  });
});

describe("countLines", () => {
  test("末尾の改行の後ろは行として数えない", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\n")).toBe(1);
    expect(countLines("a\nb\n")).toBe(2);
  });
});

describe("diffFile", () => {
  let repo: string;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), "mdecho-git-lines-"));
    await $`git init -q -b main && git config user.email t@example.com && git config user.name t`.cwd(
      repo,
    );
    await writeFile(join(repo, "a.md"), "1\n2\n3\n4\n5\n");
    await $`git add -A && git commit -q -m init`.cwd(repo);
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  test("baseとのmerge-baseから作業ツリーまでの変更行を返す", async () => {
    await $`git switch -q -c feature`.cwd(repo);
    await writeFile(join(repo, "a.md"), "1\ntwo\n3\n4\n5\n");
    await $`git commit -q -am feature`.cwd(repo);
    await writeFile(join(repo, "a.md"), "1\ntwo\n3\n4\n5\n6\n");

    expect(await diffFile("main", join(repo, "a.md"))).toEqual({
      status: "modified",
      added: 2,
      deleted: 1,
      ranges: [
        { start: 2, end: 2 },
        { start: 6, end: 6 },
      ],
    });
    // @なら未コミットの分だけ
    expect(await diffFile("@", join(repo, "a.md"))).toEqual({
      status: "modified",
      added: 1,
      deleted: 0,
      ranges: [{ start: 6, end: 6 }],
    });
  });

  test("変わっていなければunchanged", async () => {
    expect(await diffFile("@", join(repo, "a.md"))).toEqual({
      status: "unchanged",
      added: 0,
      deleted: 0,
      ranges: [],
    });
  });

  test("untrackedのファイルは全行を追加として返す", async () => {
    await writeFile(join(repo, "new.md"), "# new\n\nbody\n");

    expect(await diffFile("@", join(repo, "new.md"))).toEqual({
      status: "added",
      added: 3,
      deleted: 0,
      ranges: [{ start: 1, end: 3 }],
    });
  });

  test("baseに無かったファイルは全行を追加として返す", async () => {
    await $`git switch -q -c feature`.cwd(repo);
    await writeFile(join(repo, "added.md"), "# added\n");
    await $`git add -A && git commit -q -m added`.cwd(repo);

    expect(await diffFile("main", join(repo, "added.md"))).toEqual({
      status: "added",
      added: 1,
      deleted: 0,
      ranges: [{ start: 1, end: 1 }],
    });
  });
});
