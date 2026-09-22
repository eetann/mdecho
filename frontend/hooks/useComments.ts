import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { keyOf, parseKey } from "../lib/comment-keys.ts";
import { buildInitialCommentText } from "../lib/comment-text.ts";
import {
  clearAllComments,
  type CommentStore,
  loadComments,
  loadOtherStores,
  saveComments,
} from "../lib/comment-store.ts";
import type { CommentGroup } from "../lib/clipboard-text.ts";
import type { Comment } from "../lib/types.ts";

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

/**
 * relPath: Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス
 * filePath: `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス
 */
export function useComments(relPath: string, filePath: string) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    comments: loadComments(relPath),
    editingKey: null,
    editingInitialText: "",
  }));
  // リンクを辿った先で書いたコメントもまとめてコピーできるようにする。
  // 他のファイルの分はそのファイルを開いている間しか変わらないため、初回に読むだけでよい。
  const [otherStores, setOtherStores] = useState<CommentStore[]>(() => loadOtherStores(relPath));

  useEffect(() => {
    saveComments(relPath, filePath, state.comments);
  }, [state.comments, relPath, filePath]);

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

  const deleteAllComments = useCallback(() => {
    clearAllComments();
    setOtherStores([]);
    dispatch({ type: "deleteAll" });
  }, []);

  // 表示中のファイルを先頭にして、残りはパス順(loadOtherStoresの並び)で続ける。
  const commentGroups = useMemo<CommentGroup[]>(() => {
    const groups: CommentGroup[] = [];
    if (state.comments.size > 0) {
      groups.push({ filePath, comments: Array.from(state.comments.values()) });
    }
    for (const store of otherStores) {
      groups.push({ filePath: store.filePath, comments: Array.from(store.comments.values()) });
    }
    return groups;
  }, [state.comments, otherStores, filePath]);

  const otherFileCount = otherStores.reduce((total, store) => total + store.comments.size, 0);

  return {
    comments: state.comments,
    editingKey: state.editingKey,
    editingInitialText: state.editingInitialText,
    /** コピー対象。表示中のファイルと、リンク先で書いたコメントを合わせたもの */
    commentGroups,
    /** 表示中のファイル以外に残っているコメントの数 */
    otherFileCount,
    openEditor,
    cancelEditing,
    save,
    deleteComment,
    deleteAllComments,
  };
}
