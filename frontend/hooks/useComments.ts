import { useCallback, useEffect, useReducer } from "react";
import { keyOf, parseKey } from "../lib/comment-keys.ts";
import { buildInitialCommentText } from "../lib/comment-text.ts";
import type { Comment } from "../lib/types.ts";

const STORAGE_KEY = "mdecho:comments";

interface CommentsState {
  comments: Map<string, Comment>;
  editingKey: string | null;
  editingInitialText: string;
}

type CommentsAction =
  | { type: "open"; key: string; quotedText?: string }
  | { type: "cancel" }
  | { type: "save"; key: string; text: string }
  | { type: "delete"; key: string }
  | { type: "deleteAll" };

function loadInitialComments(): Map<string, Comment> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      return new Map(JSON.parse(raw));
    }
  } catch {
    // sessionStorageが使えない、または壊れたデータは無視
  }
  return new Map();
}

function reducer(state: CommentsState, action: CommentsAction): CommentsState {
  switch (action.type) {
    case "open": {
      // 既に同じキーを編集中ならno-op(入力途中のテキストを巻き戻さない)
      if (state.editingKey === action.key) return state;
      const existing = state.comments.get(action.key);
      return {
        ...state,
        editingKey: action.key,
        editingInitialText: existing?.text ?? action.quotedText ?? "",
      };
    }
    case "cancel": {
      if (state.editingKey === null) return state;
      return { ...state, editingKey: null, editingInitialText: "" };
    }
    case "save": {
      const text = action.text.trim();
      const next = new Map(state.comments);
      if (text === "") {
        next.delete(action.key);
      } else {
        const { startLine, endLine } = parseKey(action.key);
        next.set(action.key, { startLine, endLine, text });
      }
      return {
        comments: next,
        editingKey: state.editingKey === action.key ? null : state.editingKey,
        editingInitialText: state.editingKey === action.key ? "" : state.editingInitialText,
      };
    }
    case "delete": {
      if (!state.comments.has(action.key)) return state;
      const next = new Map(state.comments);
      next.delete(action.key);
      return {
        comments: next,
        editingKey: state.editingKey === action.key ? null : state.editingKey,
        editingInitialText: state.editingKey === action.key ? "" : state.editingInitialText,
      };
    }
    case "deleteAll": {
      if (state.comments.size === 0) return state;
      return { comments: new Map(), editingKey: null, editingInitialText: "" };
    }
    default:
      return state;
  }
}

export function useComments() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    comments: loadInitialComments(),
    editingKey: null,
    editingInitialText: "",
  }));

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.comments.entries())));
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }
  }, [state.comments]);

  const openEditor = useCallback(
    (startLine: number, endLine: number, sentenceIndex = 0, selectedText?: string) => {
      const quotedText =
        selectedText !== undefined ? buildInitialCommentText(selectedText) : undefined;
      dispatch({ type: "open", key: keyOf(startLine, endLine, sentenceIndex), quotedText });
    },
    [],
  );

  const cancelEditing = useCallback(() => dispatch({ type: "cancel" }), []);

  const save = useCallback(
    (key: string, text: string) => dispatch({ type: "save", key, text }),
    [],
  );

  const deleteComment = useCallback((key: string) => dispatch({ type: "delete", key }), []);

  const deleteAllComments = useCallback(() => dispatch({ type: "deleteAll" }), []);

  return {
    comments: state.comments,
    editingKey: state.editingKey,
    editingInitialText: state.editingInitialText,
    openEditor,
    cancelEditing,
    save,
    deleteComment,
    deleteAllComments,
  };
}
