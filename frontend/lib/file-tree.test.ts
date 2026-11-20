import { describe, expect, test } from "bun:test";
import { buildFileTree, type FileTreeNode } from "./file-tree.ts";
import type { EntryFile } from "./types.ts";

function entry(filePath: string): EntryFile {
  return { url: `/${filePath}`, relPath: filePath, filePath, hash: "h" };
}

/** 比べやすいよう、ファイルは名前だけ、ディレクトリは[名前, 子]にする */
function shape(nodes: FileTreeNode[]): unknown[] {
  return nodes.map((node) =>
    node.kind === "file" ? node.name : [node.name, shape(node.children)],
  );
}

describe("buildFileTree", () => {
  test("ディレクトリごとにまとめ、ディレクトリを先に並べる", () => {
    const tree = buildFileTree([
      entry("README.md"),
      entry("docs/a.md"),
      entry("src/x.md"),
      entry("docs/b.md"),
    ]);
    expect(shape(tree)).toEqual([["docs", ["a.md", "b.md"]], ["src", ["x.md"]], "README.md"]);
  });

  test("ディレクトリ1つだけを持つ階層は1行にまとめる", () => {
    const tree = buildFileTree([entry("docs/guide/intro/a.md"), entry("docs/guide/intro/b.md")]);
    expect(shape(tree)).toEqual([["docs/guide/intro", ["a.md", "b.md"]]]);
  });

  test("途中で枝分かれするところまでをまとめる", () => {
    const tree = buildFileTree([entry("docs/guide/a.md"), entry("docs/api/b.md")]);
    expect(shape(tree)).toEqual([
      [
        "docs",
        [
          ["guide", ["a.md"]],
          ["api", ["b.md"]],
        ],
      ],
    ]);
  });

  test("先頭の./は無視し、../は階層として残す", () => {
    const tree = buildFileTree([entry("./a.md"), entry("../other/b.md")]);
    expect(shape(tree)).toEqual([["../other", ["b.md"]], "a.md"]);
  });

  test("絶対パスはルートから辿る", () => {
    const tree = buildFileTree([entry("/tmp/x/a.md"), entry("/tmp/y/b.md")]);
    expect(shape(tree)).toEqual([
      [
        "/tmp",
        [
          ["x", ["a.md"]],
          ["y", ["b.md"]],
        ],
      ],
    ]);
  });

  test("ディレクトリのキーはルートからのパスになる", () => {
    const tree = buildFileTree([entry("docs/guide/a.md"), entry("docs/api/b.md")]);
    const docs = tree[0];
    if (docs?.kind !== "dir") throw new Error("docsがディレクトリになっていない");
    expect(docs.key).toBe("docs");
    expect(docs.children.map((child) => (child.kind === "dir" ? child.key : ""))).toEqual([
      "docs/guide",
      "docs/api",
    ]);
  });

  test("ファイルにはEntryFileがそのまま付く", () => {
    const a = entry("docs/a.md");
    const tree = buildFileTree([a]);
    const docs = tree[0];
    if (docs?.kind !== "dir") throw new Error("docsがディレクトリになっていない");
    expect(docs.children[0]).toEqual({ kind: "file", name: "a.md", entry: a });
  });
});
