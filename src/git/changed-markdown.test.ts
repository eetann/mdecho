import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { listChangedMarkdown } from "./changed-markdown.ts";

let repo: string;

async function write(path: string, content = "# test\n") {
  await mkdir(join(repo, path, ".."), { recursive: true });
  await writeFile(join(repo, path), content);
}

async function commit(message: string) {
  await $`git add -A && git commit -q -m ${message}`.cwd(repo);
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "mdecho-git-"));
  await $`git init -q -b main && git config user.email t@example.com && git config user.name t`.cwd(
    repo,
  );
  await write("keep.md");
  await write("edit.md");
  await write("remove.md");
  await write("old-name.md", "# rename target\n\n本文はリネームで変わらない\n");
  await commit("init");
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("listChangedMarkdown", () => {
  test("@なら未コミットの変更とuntrackedの.mdを返し、削除と.md以外は含めない", async () => {
    await write("edit.md", "# edited\n");
    await write("new.md");
    await write("docs/nested.markdown");
    await write("note.txt");
    await rm(join(repo, "remove.md"));

    expect(await listChangedMarkdown("@", repo)).toEqual([
      "docs/nested.markdown",
      "edit.md",
      "new.md",
    ]);
  });

  test("gitignoreされたuntrackedのファイルは含めない", async () => {
    await write(".gitignore", "ignored.md\n");
    await write("ignored.md");

    expect(await listChangedMarkdown("@", repo)).toEqual([]);
  });

  test("リネームされたファイルは新しいパスで返す", async () => {
    await $`git mv old-name.md new-name.md`.cwd(repo);

    expect(await listChangedMarkdown("@", repo)).toEqual(["new-name.md"]);
  });

  test("ブランチ名を渡すとmerge-baseからの差分を返し、base側で進んだ分は含めない", async () => {
    await $`git switch -q -c feature`.cwd(repo);
    await write("feature.md");
    await commit("feature");

    await $`git switch -q main`.cwd(repo);
    await write("main-only.md");
    await commit("main");
    await $`git switch -q feature`.cwd(repo);
    await write("wip.md");

    expect(await listChangedMarkdown("main", repo)).toEqual(["feature.md", "wip.md"]);
  });

  test("サブディレクトリから実行するとcwdからの相対パスで返す", async () => {
    await write("docs/a.md");
    await write("top.md");

    expect(await listChangedMarkdown("@", join(repo, "docs"))).toEqual(["a.md", "../top.md"]);
  });

  test("存在しないbaseはgitのエラーメッセージで失敗する", async () => {
    expect(listChangedMarkdown("no-such-branch", repo)).rejects.toThrow(/no-such-branch/);
  });
});
