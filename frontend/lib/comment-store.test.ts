import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearAllComments,
  type CommentStore,
  loadComments,
  loadOtherStores,
  saveComments,
} from "./comment-store.ts";
import type { Comment } from "./types.ts";

/** BunにはsessionStorageが無いので、必要な分だけ差し替える */
class MemoryStorage {
  private entries = new Map<string, string>();
  get length(): number {
    return this.entries.size;
  }
  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

function comment(startLine: number, text: string): Comment {
  return { startLine, endLine: startLine, text };
}

beforeEach(() => {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = new MemoryStorage();
});

afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe("saveComments / loadComments", () => {
  test("保存したコメントを読み戻せる", () => {
    const comments = new Map([["9-9", comment(9, "ここ直して")]]);
    saveComments("doc.md", "docs/doc.md", comments);
    expect(loadComments("doc.md")).toEqual(comments);
  });

  test("保存していないファイルは空のMapになる", () => {
    expect(loadComments("doc.md").size).toBe(0);
  });

  test("壊れたデータは空のMapとして扱う", () => {
    sessionStorage.setItem("mdecho:comments:doc.md", "{{");
    expect(loadComments("doc.md").size).toBe(0);
  });

  test("形式の違うデータも空のMapとして扱う", () => {
    sessionStorage.setItem("mdecho:comments:doc.md", JSON.stringify([["9-9", comment(9, "旧")]]));
    expect(loadComments("doc.md").size).toBe(0);
  });
});

describe("loadOtherStores", () => {
  test("表示中のファイル以外を、クリップボード用のパス付きでパス順に返す", () => {
    saveComments("index.md", "docs/index.md", new Map([["1-1", comment(1, "A")]]));
    saveComments("sub/b.md", "docs/sub/b.md", new Map([["2-2", comment(2, "B")]]));
    saveComments("a.md", "docs/a.md", new Map([["3-3", comment(3, "C")]]));

    const others = loadOtherStores("index.md");
    expect(others.map((store: CommentStore) => store.relPath)).toEqual(["a.md", "sub/b.md"]);
    expect(others[0]?.filePath).toBe("docs/a.md");
    expect(others[1]?.comments.get("2-2")?.text).toBe("B");
  });

  test("コメントが空になったファイルは含めない", () => {
    saveComments("index.md", "docs/index.md", new Map([["1-1", comment(1, "A")]]));
    saveComments("empty.md", "docs/empty.md", new Map());
    expect(loadOtherStores("index.md")).toEqual([]);
  });

  test("mdechoのコメント以外のキーは読まない", () => {
    sessionStorage.setItem("mdecho:cursorLine", "12");
    saveComments("index.md", "docs/index.md", new Map([["1-1", comment(1, "A")]]));
    expect(loadOtherStores("other.md").map((store) => store.relPath)).toEqual(["index.md"]);
  });
});

describe("clearAllComments", () => {
  test("どのファイルのコメントも消えるが、他のキーは残す", () => {
    sessionStorage.setItem("mdecho:cursorLine", "12");
    saveComments("index.md", "docs/index.md", new Map([["1-1", comment(1, "A")]]));
    saveComments("a.md", "docs/a.md", new Map([["3-3", comment(3, "C")]]));

    clearAllComments();

    expect(loadComments("index.md").size).toBe(0);
    expect(loadOtherStores("index.md")).toEqual([]);
    expect(sessionStorage.getItem("mdecho:cursorLine")).toBe("12");
  });
});

describe("saveComments - 空になったとき", () => {
  test("コメントが無くなったファイルはエントリごと消す", () => {
    saveComments("doc.md", "docs/doc.md", new Map([["9-9", comment(9, "ここ直して")]]));
    saveComments("doc.md", "docs/doc.md", new Map());
    expect(sessionStorage.getItem("mdecho:comments:doc.md")).toBeNull();
  });
});
