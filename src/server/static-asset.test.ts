import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocRoot, type DocRoot } from "./doc-path.ts";
import { isServableAssetPath, resolveServableAsset } from "./static-asset.ts";

describe("isServableAssetPath", () => {
  test("画像の拡張子は配信対象", () => {
    for (const path of ["a.png", "sub/b.JPG", "c.svg", "d.webp", "e.ico"]) {
      expect(isServableAssetPath(path)).toBe(true);
    }
  });

  test("画像以外は配信対象外", () => {
    for (const path of [".env", "a.ts", "b.txt", "c.zip", "id_rsa", "d.md", "e.png.txt"]) {
      expect(isServableAssetPath(path)).toBe(false);
    }
  });
});

/**
 * symlinkとrealpathを見る関数なので、実際のファイルを置いて確かめる。
 * macOSの/tmpは/private/tmpへのsymlinkなので、baseDir側もrealpathで揃える必要がある
 * (揃えないと配下のファイルまで境界チェックで落ちる)。
 */
describe("resolveServableAsset", () => {
  let dir: string;
  let root: DocRoot;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "mdecho-static-asset-"));
    const entry = join(dir, "doc.md");
    root = createDocRoot(entry, dir);
    await mkdir(join(dir, "sub"), { recursive: true });
    await mkdir(join(dir, "dir.png"), { recursive: true });
    await writeFile(entry, "# doc\n");
    await writeFile(join(dir, "image.png"), "png");
    await writeFile(join(dir, "diagram.svg"), "<svg></svg>");
    await writeFile(join(dir, ".env"), "SECRET=1");
    await writeFile(join(dir, "code.ts"), "export const a = 1;");
    await writeFile(join(dir, "sub", "nested.png"), "png");
    await writeFile(join(dir, "dir.png", "index.html"), "<p>x</p>");
    await writeFile(join(dir, "outside-target.png"), "png");
    await symlink(join(dir, "image.png"), join(dir, "inside-link.png"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("同じディレクトリの画像は配信する", async () => {
    await expect(resolveServableAsset(root, "/image.png")).resolves.toBeDefined();
    await expect(resolveServableAsset(root, "/sub/nested.png")).resolves.toBeDefined();
    await expect(resolveServableAsset(root, "/diagram.svg")).resolves.toBeDefined();
  });

  test(".envや拡張子の無いファイルは配信しない", async () => {
    await expect(resolveServableAsset(root, "/.env")).resolves.toBeUndefined();
    await expect(resolveServableAsset(root, "/code.ts")).resolves.toBeUndefined();
    await expect(resolveServableAsset(root, "/doc.md")).resolves.toBeUndefined();
  });

  test("存在しない画像は配信しない", async () => {
    await expect(resolveServableAsset(root, "/missing.png")).resolves.toBeUndefined();
  });

  test("ディレクトリ配下から出るパスは配信しない", async () => {
    await expect(resolveServableAsset(root, "/../outside.png")).resolves.toBeUndefined();
    await expect(resolveServableAsset(root, "/%2e%2e/outside.png")).resolves.toBeUndefined();
  });

  test("ディレクトリ内のsymlinkでも、実体が配下なら配信する", async () => {
    await expect(resolveServableAsset(root, "/inside-link.png")).resolves.toBeDefined();
  });

  test("ディレクトリ外を指すsymlinkは配信しない", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "mdecho-static-asset-outside-"));
    const secret = join(outsideDir, "secret.png");
    await writeFile(secret, "png");
    await symlink(secret, join(dir, "escape.png"));
    try {
      await expect(resolveServableAsset(root, "/escape.png")).resolves.toBeUndefined();
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  test("画像の拡張子を持つディレクトリは配信しない(中のindex.htmlが出るのを防ぐ)", async () => {
    await expect(resolveServableAsset(root, "/dir.png")).resolves.toBeUndefined();
  });
});
