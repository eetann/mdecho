import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createDocRoot as createDocRootWithGit,
  type CreateDocRootOptions,
  findGitRoot,
  isMarkdownPath,
  resolveDoc,
  resolveLinkUrl,
} from "./doc-path.ts";

/** テストを動かす環境の上位に.gitがあっても結果が変わらないよう、既定ではgitを探さない */
function createDocRoot(entry: string, cwd: string, options: CreateDocRootOptions = {}) {
  return createDocRootWithGit(entry, cwd, { findGitRoot: () => undefined, ...options });
}

const PROJECT = resolve("/tmp/mdecho-doc-path");
const BASE_DIR = join(PROJECT, "docs");
const ENTRY = join(BASE_DIR, "index.md");
// cwdをエントリのディレクトリにすると、配信範囲もそこになる
const ROOT = createDocRoot(ENTRY, BASE_DIR);

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

describe("createDocRoot", () => {
  test("エントリがcwdの配下なら、cwdを配信範囲にする", () => {
    expect(createDocRoot("docs/index.md", PROJECT)).toEqual({
      rootDir: PROJECT,
      entryFilePath: "docs/index.md",
      entryAbsPath: ENTRY,
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
    expect(resolveDoc(ROOT, "/")).toEqual({
      absPath: ENTRY,
      relPath: "index.md",
      displayPath: ENTRY,
    });
  });

  test("同じディレクトリのファイルを解決する", () => {
    expect(resolveDoc(ROOT, "/foo.md")).toEqual({
      absPath: join(BASE_DIR, "foo.md"),
      relPath: "foo.md",
      displayPath: join(BASE_DIR, "foo.md"),
    });
  });

  test("サブディレクトリのファイルを解決する", () => {
    const resolved = resolveDoc(ROOT, "/sub/bar.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "sub", "bar.md"));
    expect(resolved?.relPath).toBe("sub/bar.md");
  });

  test("パーセントエンコードされたパスをデコードする", () => {
    const resolved = resolveDoc(ROOT, "/%E6%97%A5%E6%9C%AC%E8%AA%9E.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "日本語.md"));
    expect(resolved?.relPath).toBe("日本語.md");
  });

  test("`..`を含むパスを正規化する", () => {
    const resolved = resolveDoc(ROOT, "/sub/../foo.md");
    expect(resolved?.absPath).toBe(join(BASE_DIR, "foo.md"));
    expect(resolved?.relPath).toBe("foo.md");
  });

  test("配信範囲の外を指すパスは解決しない", () => {
    expect(resolveDoc(ROOT, "/../secret.md")).toBeUndefined();
    expect(resolveDoc(ROOT, "/sub/../../secret.md")).toBeUndefined();
    expect(resolveDoc(ROOT, "/%2e%2e/secret.md")).toBeUndefined();
  });

  test("デコードできないパスとヌル文字入りのパスは解決しない", () => {
    expect(resolveDoc(ROOT, "/%E3%81")).toBeUndefined();
    expect(resolveDoc(ROOT, "/foo%00.md")).toBeUndefined();
  });

  test("配信範囲がcwdなら、URLとrelPathはcwdからのパスになる", () => {
    const root = createDocRoot("docs/index.md", PROJECT);
    expect(resolveDoc(root, "/")?.relPath).toBe("docs/index.md");
    expect(resolveDoc(root, "/README.md")).toEqual({
      absPath: join(PROJECT, "README.md"),
      relPath: "README.md",
      displayPath: "README.md",
    });
  });

  test("エントリ以外のdisplayPathは`-f`のパスと同じ書き方になる", () => {
    const root = createDocRoot("docs/index.md", PROJECT);
    expect(resolveDoc(root, "/docs/sub/bar.md")?.displayPath).toBe("docs/sub/bar.md");
    const dotRoot = createDocRoot("./index.md", BASE_DIR);
    expect(resolveDoc(dotRoot, "/sub/bar.md")?.displayPath).toBe("sub/bar.md");
  });

  test("エントリ自身のdisplayPathは`-f`に渡した表記のまま", () => {
    const root = createDocRoot("./docs/index.md", PROJECT);
    expect(resolveDoc(root, "/")?.displayPath).toBe("./docs/index.md");
    expect(resolveDoc(root, "/docs/index.md")?.displayPath).toBe("./docs/index.md");
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

  test("配信範囲がエントリのディレクトリなら、ルート基準もそこになる", async () => {
    const root = createDocRoot(doc, join(dir, "src"));
    expect(root.rootDir).toBe(join(dir, "docs", "deep"));
    expect(await resolveLinkUrl(root, doc, "foo.ts", ASK_LINK)).toEqual({ url: "/foo.ts" });
  });
});
