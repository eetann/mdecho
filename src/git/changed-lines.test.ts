import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { listChangedLines, parseChangedLines } from "./changed-lines.ts";

describe("parseChangedLines", () => {
  test("hunkヘッダーから変更後の行範囲を取り出し、削除だけのhunkは無視する", () => {
    const diff = [
      "diff --git a/a.md b/a.md",
      "--- a/a.md",
      "+++ b/a.md",
      "@@ -2 +2 @@",
      "@@ -5,0 +6,3 @@ ## 見出し",
      "@@ -10,2 +12,0 @@",
    ].join("\n");

    expect(parseChangedLines(diff)).toEqual([
      { start: 2, end: 2 },
      { start: 6, end: 8 },
    ]);
  });

  test("新しく追加されたファイルは空を返す", () => {
    const diff = ["--- /dev/null", "+++ b/a.md", "@@ -0,0 +1,3 @@"].join("\n");

    expect(parseChangedLines(diff)).toEqual([]);
  });
});

describe("listChangedLines", () => {
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

    expect(await listChangedLines("main", join(repo, "a.md"))).toEqual([
      { start: 2, end: 2 },
      { start: 6, end: 6 },
    ]);
    // @なら未コミットの分だけ
    expect(await listChangedLines("@", join(repo, "a.md"))).toEqual([{ start: 6, end: 6 }]);
  });

  test("untrackedのファイルは空を返す", async () => {
    await writeFile(join(repo, "new.md"), "# new\n");

    expect(await listChangedLines("@", join(repo, "new.md"))).toEqual([]);
  });

  test("baseに無かったファイルは空を返す", async () => {
    await $`git switch -q -c feature`.cwd(repo);
    await writeFile(join(repo, "added.md"), "# added\n");
    await $`git add -A && git commit -q -m added`.cwd(repo);

    expect(await listChangedLines("main", join(repo, "added.md"))).toEqual([]);
  });
});
