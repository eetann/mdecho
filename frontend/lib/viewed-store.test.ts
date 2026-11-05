import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { isViewed, loadViewed, saveViewed, toggleViewed } from "./viewed-store.ts";

/** BunにはsessionStorageが無いので、必要な分だけ差し替える */
class MemoryStorage {
  private entries = new Map<string, string>();
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

beforeEach(() => {
  (globalThis as { sessionStorage?: unknown }).sessionStorage = new MemoryStorage();
});

afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe("viewed-store", () => {
  test("保存した既読を読み戻す", () => {
    saveViewed({ "docs/a.md": "h1" });
    expect(loadViewed()).toEqual({ "docs/a.md": "h1" });
  });

  test("壊れたデータは空として扱う", () => {
    sessionStorage.setItem("mdecho:viewed", "not json");
    expect(loadViewed()).toEqual({});
    sessionStorage.setItem("mdecho:viewed", JSON.stringify({ "a.md": 1, "b.md": "h" }));
    expect(loadViewed()).toEqual({ "b.md": "h" });
  });

  test("チェックしたときと内容が変わっていれば既読ではない", () => {
    const viewed = { "a.md": "h1" };
    expect(isViewed(viewed, "a.md", "h1")).toBe(true);
    expect(isViewed(viewed, "a.md", "h2")).toBe(false);
    expect(isViewed(viewed, "b.md", "h1")).toBe(false);
  });

  test("ハッシュが取れないファイルは既読にしない", () => {
    expect(isViewed({ "a.md": "" }, "a.md", "")).toBe(false);
  });

  test("切り替えると既読と未読が入れ替わり、内容が変わったものは既読に付け直す", () => {
    expect(toggleViewed({}, "a.md", "h1")).toEqual({ "a.md": "h1" });
    expect(toggleViewed({ "a.md": "h1" }, "a.md", "h1")).toEqual({});
    expect(toggleViewed({ "a.md": "h1" }, "a.md", "h2")).toEqual({ "a.md": "h2" });
  });
});
