import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { keyOf, parseKey } from "../lib/comment-keys.ts";
import { remapComments, sliceLines } from "../lib/comment-remap.ts";
import { buildInitialCommentText, insertQuote } from "../lib/comment-text.ts";
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
  /** 本文が書き換わって付け先を失ったコメント。コピーの対象には含めない */
  outdated: Comment[];
  editingKey: string | null;
  editingInitialText: string;
  /**
   * 編集中のエディタへ差し込みたい引用。書きかけの文はエディタ側にしかないため、ここでは渡すだけにする。
   * idは同じ文を続けて引用しても別の依頼として扱うためのもの
   */
  pendingQuote: PendingQuote | null;
}

export interface PendingQuote {
  id: number;
  text: string;
}

type CommentsAction =
  | { type: "open"; key: string; quotedText?: string }
  | { type: "cancel" }
  | { type: "save"; key: string; text: string; source: string }
  | { type: "delete"; key: string }
  | { type: "deleteAll" }
  | { type: "clearOutdated" };

function reducer(state: CommentsState, action: CommentsAction): CommentsState {
  switch (action.type) {
    case "open": {
      // 既に同じキーを編集中なら入力途中のテキストを巻き戻さず、引用だけエディタへ渡す
      if (state.editingKey === action.key) {
        if (action.quotedText === undefined) return state;
        return {
          ...state,
          pendingQuote: { id: (state.pendingQuote?.id ?? 0) + 1, text: action.quotedText },
        };
      }
      const existing = state.comments.get(action.key)?.text;
      let initialText = existing ?? action.quotedText ?? "";
      if (existing !== undefined && action.quotedText !== undefined) {
        initialText = insertQuote(existing, existing.length, action.quotedText).text;
      }
      return {
        ...state,
        editingKey: action.key,
        editingInitialText: initialText,
        pendingQuote: null,
      };
    }
    case "cancel": {
      if (state.editingKey === null) return state;
      return { ...state, editingKey: null, editingInitialText: "", pendingQuote: null };
    }
    case "save": {
      const text = action.text.trim();
      const next = new Map(state.comments);
      if (text === "") {
        next.delete(action.key);
      } else {
        const { startLine, endLine } = parseKey(action.key);
        const originalText = sliceLines(action.source, startLine, endLine);
        next.set(action.key, { startLine, endLine, text, originalText });
      }
      return {
        ...state,
        comments: next,
        editingKey: state.editingKey === action.key ? null : state.editingKey,
        editingInitialText: state.editingKey === action.key ? "" : state.editingInitialText,
        pendingQuote: state.editingKey === action.key ? null : state.pendingQuote,
      };
    }
    case "delete": {
      if (!state.comments.has(action.key)) return state;
      const next = new Map(state.comments);
      next.delete(action.key);
      return {
        ...state,
        comments: next,
        editingKey: state.editingKey === action.key ? null : state.editingKey,
        editingInitialText: state.editingKey === action.key ? "" : state.editingInitialText,
        pendingQuote: state.editingKey === action.key ? null : state.pendingQuote,
      };
    }
    case "deleteAll": {
      if (state.comments.size === 0 && state.outdated.length === 0) return state;
      return {
        comments: new Map(),
        outdated: [],
        editingKey: null,
        editingInitialText: "",
        pendingQuote: null,
      };
    }
    case "clearOutdated": {
      if (state.outdated.length === 0) return state;
      return { ...state, outdated: [] };
    }
    default:
      return state;
  }
}

/**
 * relPath: Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス
 * filePath: `-f`に渡したパスと同じ書き方で表した、表示中ファイルのパス
 * source: 表示中ファイルのMarkdown原文
 */
export function useComments(relPath: string, filePath: string, source: string) {
  const [state, dispatch] = useReducer(reducer, undefined, (): CommentsState => {
    const loaded = loadComments(relPath);
    // 前回保存してから原文が変わっていれば、行のずれに追従させ、書き換わった箇所はoutdatedに回す。
    // 原文を持たない古いデータは、比べようがないのでそのまま使う。
    const remapped =
      loaded.source === undefined
        ? { comments: loaded.comments, outdated: [] }
        : remapComments(loaded.comments, loaded.source, source);
    return {
      comments: remapped.comments,
      outdated: [...loaded.outdated, ...remapped.outdated],
      editingKey: null,
      editingInitialText: "",
      pendingQuote: null,
    };
  });
  // リンクを辿った先で書いたコメントもまとめてコピーできるようにする。
  // 他のファイルの分はそのファイルを開いている間しか変わらないため、初回に読むだけでよい。
  const [otherStores, setOtherStores] = useState<CommentStore[]>(() => loadOtherStores(relPath));

  useEffect(() => {
    // 付け替え後の行番号は今の原文に対するものなので、原文も今のものに揃えて保存する。
    saveComments(relPath, filePath, state.comments, { outdated: state.outdated, source });
  }, [state.comments, state.outdated, relPath, filePath, source]);

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
    (key: string, text: string) => dispatch({ type: "save", key, text, source }),
    [source],
  );

  const deleteComment = useCallback((key: string) => dispatch({ type: "delete", key }), []);

  const clearOutdatedComments = useCallback(() => dispatch({ type: "clearOutdated" }), []);

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
    outdatedComments: state.outdated,
    editingKey: state.editingKey,
    editingInitialText: state.editingInitialText,
    pendingQuote: state.pendingQuote,
    /** コピー対象。表示中のファイルと、リンク先で書いたコメントを合わせたもの */
    commentGroups,
    /** 表示中のファイル以外に残っているコメントの数 */
    otherFileCount,
    openEditor,
    cancelEditing,
    save,
    deleteComment,
    deleteAllComments,
    clearOutdatedComments,
  };
}
