import { describe, expect, test } from "bun:test";
import { type CommentsState, commentsReducer } from "./useComments.ts";

function emptyState(): CommentsState {
  return {
    comments: new Map(),
    outdated: [],
    editing: new Map(),
    activeKey: null,
    pendingQuote: null,
  };
}

describe("commentsReducer", () => {
  test("別の行でエディタを開いても、先に開いていたエディタは閉じない", () => {
    let state = commentsReducer(emptyState(), { type: "open", key: "1-1" });
    state = commentsReducer(state, { type: "open", key: "3-3" });
    expect(Array.from(state.editing.keys())).toEqual(["1-1", "3-3"]);
    expect(state.activeKey).toBe("3-3");
  });

  test("閉じるのは対象のエディタだけ", () => {
    let state = commentsReducer(emptyState(), { type: "open", key: "1-1" });
    state = commentsReducer(state, { type: "open", key: "3-3" });
    state = commentsReducer(state, { type: "cancel", key: "3-3" });
    expect(Array.from(state.editing.keys())).toEqual(["1-1"]);
    expect(state.activeKey).toBeNull();

    state = commentsReducer(state, { type: "save", key: "1-1", text: "memo", source: "a\n" });
    expect(state.editing.size).toBe(0);
    expect(state.comments.get("1-1")?.text).toBe("memo");
  });

  test("アクティブでないエディタを閉じてもアクティブなエディタは変わらない", () => {
    let state = commentsReducer(emptyState(), { type: "open", key: "1-1" });
    state = commentsReducer(state, { type: "open", key: "3-3" });
    state = commentsReducer(state, { type: "cancel", key: "1-1" });
    expect(state.activeKey).toBe("3-3");
  });

  test("フォーカスしたエディタがアクティブになる", () => {
    let state = commentsReducer(emptyState(), { type: "open", key: "1-1" });
    state = commentsReducer(state, { type: "open", key: "3-3" });
    state = commentsReducer(state, { type: "activate", key: "1-1" });
    expect(state.activeKey).toBe("1-1");
  });

  test("開いているエディタへの引用は、そのエディタ宛てにidを増やしながら渡す", () => {
    let state = commentsReducer(emptyState(), { type: "open", key: "1-1" });
    state = commentsReducer(state, { type: "open", key: "3-3" });
    state = commentsReducer(state, { type: "open", key: "1-1", quotedText: "> a" });
    expect(state.pendingQuote).toEqual({ id: 1, key: "1-1", text: "> a" });
    expect(state.activeKey).toBe("1-1");

    // 別のエディタを新しく開いてもidは巻き戻らない(既存エディタが同じidを適用済みとみなさないように)
    state = commentsReducer(state, { type: "open", key: "5-5" });
    state = commentsReducer(state, { type: "open", key: "3-3", quotedText: "> b" });
    expect(state.pendingQuote).toEqual({ id: 2, key: "3-3", text: "> b" });
  });
});
