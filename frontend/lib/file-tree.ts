import type { EntryFile } from "./types.ts";

export type FileTreeNode = FileTreeDir | FileTreeFile;

export interface FileTreeDir {
  kind: "dir";
  /** 表示名。子が1つのディレクトリだけなら`docs/guide`のようにまとめる */
  name: string;
  /** 開閉の状態を覚えておくためのキー(ルートからのパス) */
  key: string;
  children: FileTreeNode[];
}

export interface FileTreeFile {
  kind: "file";
  name: string;
  entry: EntryFile;
}

interface MutableDir {
  dirs: Map<string, MutableDir>;
  files: FileTreeFile[];
}

function splitPath(filePath: string): string[] {
  const segments = filePath.split(/[\\/]/);
  // 絶対パスは先頭が空になるので、ルートを表す"/"として残す
  if (segments[0] === "") segments[0] = "/";
  // "./a.md"の"."は階層として意味が無いので捨てる。".."は場所を表すので残す
  return segments.filter((segment, index) => segment !== "." && (segment !== "" || index === 0));
}

/**
 * 指定された表記(filePath)のまま、ディレクトリごとにまとめたツリーにする。
 * 同じ階層ではディレクトリを先、ファイルを後に並べ、それぞれは指定された順を保つ。
 * 子がディレクトリ1つだけの階層は、深いツリーで横幅を食わないよう1行にまとめる。
 */
export function buildFileTree(entries: readonly EntryFile[]): FileTreeNode[] {
  const root: MutableDir = { dirs: new Map(), files: [] };
  for (const entry of entries) {
    const segments = splitPath(entry.filePath);
    const name = segments.pop() ?? entry.filePath;
    let dir = root;
    for (const segment of segments) {
      let next = dir.dirs.get(segment);
      if (!next) {
        next = { dirs: new Map(), files: [] };
        dir.dirs.set(segment, next);
      }
      dir = next;
    }
    dir.files.push({ kind: "file", name, entry });
  }
  return toNodes(root, "");
}

function toNodes(dir: MutableDir, parentKey: string): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];
  for (const [segment, child] of dir.dirs) {
    let name = segment;
    let current = child;
    // ファイルを持たず、ディレクトリ1つだけを持つ階層は畳んで1行にする
    while (current.files.length === 0 && current.dirs.size === 1) {
      const [[nextSegment, next]] = current.dirs;
      name = name === "/" ? `/${nextSegment}` : `${name}/${nextSegment}`;
      current = next;
    }
    const key = parentKey === "" ? name : `${parentKey}/${name}`;
    nodes.push({ kind: "dir", name, key, children: toNodes(current, key) });
  }
  nodes.push(...dir.files);
  return nodes;
}

/** ツリーの中のファイルを並び順どおりに数える(ディレクトリの確認済み表示に使う) */
export function collectFiles(nodes: readonly FileTreeNode[]): EntryFile[] {
  return nodes.flatMap((node) =>
    node.kind === "file" ? [node.entry] : collectFiles(node.children),
  );
}
