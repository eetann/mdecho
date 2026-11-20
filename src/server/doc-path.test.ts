import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createDocSpace as createDocSpaceWithGit,
  type CreateDocSpaceOptions,
  findGitRoot,
  isMarkdownPath,
  resolveDoc,
  resolveLinkUrl,
} from "./doc-path.ts";

/** テストを動かす環境の上位に.gitがあっても結果が変わらないよう、既定ではgitを探さない */
function createDocSpace(entries: string[], cwd: string, options: CreateDocSpaceOptions = {}) {
  return createDocSpaceWithGit(entries, cwd, { findGitRoot: () => undefined, ...options });
}

/** エントリが1つのときの配信範囲 */
function createDocRoot(entry: string, cwd: string, options: CreateDocSpaceOptions = {}) {
  const space = createDocSpace([entry], cwd, options);
  const [root] = space.roots;
  if (!root) throw new Error("root not found");
  return root;
}

const PROJECT = resolve("/tmp/mdecho-doc-path");
const BASE_DIR = join(PROJECT, "docs");
const ENTRY = join(BASE_DIR, "index.md");
// cwdをエントリのディレクトリにすると、配信範囲もそこになる
const SPACE = createDocSpace([ENTRY], BASE_DIR);
const ROOT = { rootDir: BASE_DIR, urlPrefix: "" };

describe("isMarkdownPath", () => {
  test(".mdと.markdownをMarkdownとみなす", () => {
    expect(isMarkdownPath("foo.md")).toBe(true);
    expect(isMarkdownPath("sub/FOO.MD")).toBe(true);
    expect(isMarkdownPath("foo.markdown")).toBe(true);
  });

  test("それ以外の拡張子は対象外", () => {
    expect(isMarkdownPath("foo.png")).toBe(false);
    expect(isMarkdownPath("foo.md.txt")).toBe(false);
    expect(isMarkdownPath("md")).toBe(false);
  });
});

describe("createDocSpace", () => {
  test("エントリがcwdの配下なら、cwdを配信範囲にする", () => {
    const root = { rootDir: PROJECT, urlPrefix: "" };
    expect(createDocSpace(["docs/index.md"], PROJECT)).toEqual({
      roots: [root],
      entries: [{ filePath: "docs/index.md", absPath: ENTRY, root }],
    });
  });

  test("エントリがcwdの外なら、エントリのディレクトリに留める", () => {
    const root = createDocRoot(ENTRY, join(PROJECT, "other"));
    expect(root.rootDir).toBe(BASE_DIR);
  });

  test("エントリがgitリポジトリの中なら、cwdに関わらずそのルートを配信範囲にする", () => {
    const options = { findGitRoot: () => PROJECT };
    expect(createDocRoot("index.md", BASE_DIR, options).rootDir).toBe(PROJECT);
    expect(createDocRoot(ENTRY, "/somewhere/else", options).rootDir).toBe(PROJECT);
  });

  test("同じ配信範囲になるファイルは1つのルートにまとめ、重複したファイルは除く", () => {
    const space = createDocSpace(["docs/a.md", "b.md", "./docs/a.md"], PROJECT);
    expect(space.roots).toEqual([{ rootDir: PROJECT, urlPrefix: "" }]);
    expect(space.entries.map((entry) => entry.filePath)).toEqual(["docs/a.md", "b.md"]);
  });

  test("配信範囲が別々になるファイルは、共通の祖先へ広げずに2つ目以降へ接頭辞を付ける", () => {
    const space = createDocSpace(["a.md", "/elsewhere/x/b.md", "/another/c.md"], PROJECT);
    expect(space.roots).toEqual([
      { rootDir: PROJECT, urlPrefix: "" },
      { rootDir: "/elsewhere/x", urlPrefix: "/~2" },
      { rootDir: "/another", urlPrefix: "/~3" },
    ]);
  });
});

describe("findGitRoot", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-git-root-"));
    await mkdir(join(dir, "repo", ".git"), { recursive: true });
    await mkdir(join(dir, "repo", "docs", "deep"), { recursive: true });
    // worktreeやsubmoduleでは.gitがファイルになる
    await mkdir(join(dir, "worktree", "docs"), { recursive: true });
    await writeFile(join(dir, "worktree", ".git"), "gitdir: /elsewhere\n");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("上へ辿って最初に.gitがあるディレクトリを返す", () => {
    expect(findGitRoot(join(dir, "repo", "docs", "deep"), "/nonexistent-home")).toBe(
      join(dir, "repo"),
    );
    expect(findGitRoot(join(dir, "worktree", "docs"), "/nonexistent-home")).toBe(
      join(dir, "worktree"),
    );
  });

  test("ホームディレクトリそのものの.gitはプロジェクトとみなさない", () => {
    expect(findGitRoot(join(dir, "repo", "docs"), join(dir, "repo"))).not.toBe(join(dir, "repo"));
  });
});

describe("resolveDoc", () => {
  test("ルートパスはエントリのファイルを指す", () => {
    expect(resolveDoc(SPACE, "/")).toEqual({
      absPath: ENTRY,
      relPath: "index.md",
      displayPath: ENTRY,
      root: ROOT,
    });
  });

  test("同じディレクトリのファイルを解決する", () => {
    expect(resolveDoc(SPACE, "/foo.md")).toEqual({
      absPath: join(BASE_DIR, "foo.md"),
      relPath: "foo.md",
      displayPath: join(BASE_DIR, "foo.md"),
      root: ROOT,
    });
  });

  test("サブディレクトリのファイルを解決する", () => {
    const resolved = resolveDoc(SPACE, "/sub/bar.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "sub", "bar.md"));
    expect(resolved?.relPath).toBe("sub/bar.md");
  });

  test("パーセントエンコードされたパスをデコードする", () => {
    const resolved = resolveDoc(SPACE, "/%E6%97%A5%E6%9C%AC%E8%AA%9E.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "日本語.md"));
    expect(resolved?.relPath).toBe("日本語.md");
  });

  test("`..`を含むパスを正規化する", () => {
    const resolved = resolveDoc(SPACE, "/sub/../foo.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "foo.md"));
    expect(resolved?.relPath).toBe("foo.md");
  });

  test("配信範囲の外を指すパスは解決しない", () => {
    expect(resolveDoc(SPACE, "/../secret.md")).toBeUndefined();
    expect(resolveDoc(SPACE, "/sub/../../secret.md")).toBeUndefined();
    expect(resolveDoc(SPACE, "/%2e%2e/secret.md")).toBeUndefined();
  });

  test("デコードできないパスとヌル文字入りのパスは解決しない", () => {
    expect(resolveDoc(SPACE, "/%E3%81")).toBeUndefined();
    expect(resolveDoc(SPACE, "/foo%00.md")).toBeUndefined();
  });

  test("配信範囲がcwdなら、URLとrelPathはcwdからのパスになる", () => {
    const space = createDocSpace(["docs/index.md"], PROJECT);
    expect(resolveDoc(space, "/")?.relPath).toBe("docs/index.md");
    expect(resolveDoc(space, "/README.md")).toEqual({
      absPath: join(PROJECT, "README.md"),
      relPath: "README.md",
      displayPath: "README.md",
      root: { rootDir: PROJECT, urlPrefix: "" },
    });
  });

  test("エントリ以外のdisplayPathは`-f`のパスと同じ書き方になる", () => {
    const space = createDocSpace(["docs/index.md"], PROJECT);
    expect(resolveDoc(space, "/docs/sub/bar.md")?.displayPath).toBe("docs/sub/bar.md");
    const dotSpace = createDocSpace(["./index.md"], BASE_DIR);
    expect(resolveDoc(dotSpace, "/sub/bar.md")?.displayPath).toBe("sub/bar.md");
  });

  test("エントリ自身のdisplayPathは`-f`に渡した表記のまま", () => {
    const space = createDocSpace(["./docs/index.md"], PROJECT);
    expect(resolveDoc(space, "/")?.displayPath).toBe("./docs/index.md");
    expect(resolveDoc(space, "/docs/index.md")?.displayPath).toBe("./docs/index.md");
  });

  describe("配信範囲が複数あるとき", () => {
    const OTHER = resolve("/tmp/mdecho-other");
    const space = createDocSpace(["docs/index.md", join(OTHER, "x.md")], PROJECT);
    const otherRoot = { rootDir: OTHER, urlPrefix: "/~2" };

    test("接頭辞の付いたパスは、そのルートのファイルへ解決する", () => {
      expect(resolveDoc(space, "/~2/sub/y.md")).toEqual({
        absPath: join(OTHER, "sub", "y.md"),
        relPath: "~2/sub/y.md",
        displayPath: join(OTHER, "sub", "y.md"),
        root: otherRoot,
      });
      expect(resolveDoc(space, "/~2/x.md")?.displayPath).toBe(join(OTHER, "x.md"));
    });

    test("接頭辞の無いパスは最初のルートへ解決する", () => {
      expect(resolveDoc(space, "/")?.absPath).toBe(ENTRY);
      expect(resolveDoc(space, "/README.md")?.absPath).toBe(join(PROJECT, "README.md"));
      // `~2`で始まるだけの別名は接頭辞とみなさない
      expect(resolveDoc(space, "/~20/a.md")?.absPath).toBe(join(PROJECT, "~20", "a.md"));
    });

    test("接頭辞の付いたルートの外へは出られない", () => {
      expect(resolveDoc(space, "/~2/../secret.md")).toBeUndefined();
      expect(resolveDoc(space, "/~2/%2e%2e/secret.md")).toBeUndefined();
      expect(resolveDoc(space, "/~2")).toBeUndefined();
      expect(resolveDoc(space, "/~2/")).toBeUndefined();
    });
  });
});

/** ファイルの有無で解決先が変わるため、実際のファイルを置いて確かめる */
describe("resolveLinkUrl", () => {
  let dir: string;
  let doc: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-link-url-"));
    await mkdir(join(dir, "docs", "deep"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });
    doc = join(dir, "docs", "deep", "plan.md");
    await writeFile(doc, "# plan\n");
    await writeFile(join(dir, "README.md"), "# readme\n");
    await writeFile(join(dir, "src", "foo.ts"), "export {};\n");
    await writeFile(join(dir, "docs", "deep", "pic.png"), "png");
    // Markdownファイル基準とルート基準の両方に同名のファイルがある
    await writeFile(join(dir, "docs", "deep", "both.md"), "# deep\n");
    await writeFile(join(dir, "both.md"), "# root\n");
    await writeFile(join(dir, "docs", "deep", "both.png"), "png");
    await writeFile(join(dir, "both.png"), "png");
    await writeFile(join(dir, "日本語.md"), "# ja\n");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const ASK_LINK = { mode: "ask", kind: "link" } as const;
  const ASK_IMAGE = { mode: "ask", kind: "image" } as const;

  test("Markdownファイル基準の相対パスを、配信範囲からのURLにする", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "./pic.png", ASK_IMAGE)).toEqual({
      url: "/docs/deep/pic.png",
    });
    expect(await resolveLinkUrl(root, doc, "../../README.md", ASK_LINK)).toEqual({
      url: "/README.md",
    });
  });

  test("askではMarkdownファイル基準に無ければルート基準で探す", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "src/foo.ts", ASK_LINK)).toEqual({
      url: "/src/foo.ts",
    });
  });

  test("askのリンクで両方にあるなら、ファイル基準を先にした選択肢を付ける", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "both.md", ASK_LINK)).toEqual({
      url: "/docs/deep/both.md",
      choices: [
        { base: "file", url: "/docs/deep/both.md" },
        { base: "root", url: "/both.md" },
      ],
    });
  });

  test("askの画像で両方にあるなら、ルート基準を優先して選択肢は付けない", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "both.png", ASK_IMAGE)).toEqual({ url: "/both.png" });
  });

  test("Markdownがルート直下なら、2つの基準は同じなので選択肢を付けない", async () => {
    const rootDoc = join(dir, "README.md");
    const root = createDocRoot(rootDoc, dir);
    expect(await resolveLinkUrl(root, rootDoc, "both.md", ASK_LINK)).toEqual({ url: "/both.md" });
  });

  test("askでどちらにも無ければ、リンクはファイル基準・画像はルート基準のURLにする", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "missing.md", ASK_LINK)).toEqual({
      url: "/docs/deep/missing.md",
    });
    expect(await resolveLinkUrl(root, doc, "missing.png", ASK_IMAGE)).toEqual({
      url: "/missing.png",
    });
  });

  test("fileはファイル基準だけで解決する", async () => {
    const root = createDocRoot(doc, dir);
    const options = { mode: "file", kind: "link" } as const;
    expect(await resolveLinkUrl(root, doc, "both.md", options)).toEqual({
      url: "/docs/deep/both.md",
    });
    expect(await resolveLinkUrl(root, doc, "src/foo.ts", options)).toEqual({
      url: "/docs/deep/src/foo.ts",
    });
  });

  test("rootはルート基準だけで解決する", async () => {
    const root = createDocRoot(doc, dir);
    const options = { mode: "root", kind: "link" } as const;
    expect(await resolveLinkUrl(root, doc, "both.md", options)).toEqual({ url: "/both.md" });
    expect(await resolveLinkUrl(root, doc, "pic.png", { ...options, kind: "image" })).toEqual({
      url: "/pic.png",
    });
  });

  test("パーセントエンコードされたパスもファイルを探し、URLはエンコードして返す", async () => {
    const root = createDocRoot(doc, dir);
    const encoded = encodeURIComponent("日本語.md");
    expect(await resolveLinkUrl(root, doc, encoded, ASK_LINK)).toEqual({ url: `/${encoded}` });
  });

  test("配信範囲の外を指すものと、デコードできないものは解決しない", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "../../../outside.md", ASK_LINK)).toBeUndefined();
    expect(await resolveLinkUrl(root, doc, "%E3%81", ASK_LINK)).toBeUndefined();
  });

  test("先頭が`/`のパスは、接頭辞の無いルートでは書き換えない", async () => {
    const root = createDocRoot(doc, dir);
    expect(await resolveLinkUrl(root, doc, "/README.md", ASK_LINK)).toBeUndefined();
  });

  test("先頭が`/`のパスは、接頭辞の付くルートでは接頭辞を足す", async () => {
    const root = { rootDir: dir, urlPrefix: "/~2" };
    expect(await resolveLinkUrl(root, doc, "/README.md", ASK_LINK)).toEqual({
      url: "/~2/README.md",
    });
    expect(await resolveLinkUrl(root, doc, "./pic.png", ASK_IMAGE)).toEqual({
      url: "/~2/docs/deep/pic.png",
    });
    expect(await resolveLinkUrl(root, doc, "/../outside.md", ASK_LINK)).toBeUndefined();
  });

  test("配信範囲がエントリのディレクトリなら、ルート基準もそこになる", async () => {
    const root = createDocRoot(doc, join(dir, "src"));
    expect(root.rootDir).toBe(join(dir, "docs", "deep"));
    expect(await resolveLinkUrl(root, doc, "foo.ts", ASK_LINK)).toEqual({ url: "/foo.ts" });
  });
});
