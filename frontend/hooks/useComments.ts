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
import type { Comment, EntryFile } from "../lib/types.ts";

export interface CommentsState {
  comments: Map<string, Comment>;
  /** 本文が書き換わって付け先を失ったコメント。コピーの対象には含めない */
  outdated: Comment[];
  /**
   * 開いているエディタと、それぞれを開いたときの初期テキスト。
   * 別の行でエディタを開いても書きかけを失わないよう、複数同時に開けるようにしている。
   */
  editing: Map<string, string>;
  /** 最後に開いた(またはフォーカスした)エディタ。引用の差し込み先と本文のハイライトに使う */
  activeKey: string | null;
  /**
   * 編集中のエディタへ差し込みたい引用。書きかけの文はエディタ側にしかないため、ここでは渡すだけにする。
   * idは同じ文を続けて引用しても別の依頼として扱うためのもの
   */
  pendingQuote: PendingQuote | null;
}

export interface PendingQuote {
  id: number;
  /** 差し込み先のエディタ */
  key: string;
  text: string;
}

type CommentsAction =
  | { type: "open"; key: string; quotedText?: string }
  | { type: "activate"; key: string }
  | { type: "cancel"; key: string }
  | { type: "save"; key: string; text: string; source: string }
  | { type: "delete"; key: string }
  | { type: "deleteAll" }
  | { type: "clearOutdated" };

/** keyのエディタを閉じる。アクティブだったものを閉じたら、アクティブなエディタは無しにする */
function closeEditor(state: CommentsState, key: string): CommentsState {
  if (!state.editing.has(key)) return state;
  const editing = new Map(state.editing);
  editing.delete(key);
  return {
    ...state,
    editing,
    activeKey: state.activeKey === key ? null : state.activeKey,
  };
}

export function commentsReducer(state: CommentsState, action: CommentsAction): CommentsState {
  switch (action.type) {
    case "open": {
      // 既に同じキーを編集中なら入力途中のテキストを巻き戻さず、引用だけエディタへ渡す
      if (state.editing.has(action.key)) {
        if (action.quotedText === undefined) {
          return state.activeKey === action.key ? state : { ...state, activeKey: action.key };
        }
        return {
          ...state,
          activeKey: action.key,
          // idはエディタをまたいで増やし続ける。各エディタは最後に適用したidで重複を弾いているため
          pendingQuote: {
            id: (state.pendingQuote?.id ?? 0) + 1,
            key: action.key,
            text: action.quotedText,
          },
        };
      }
      const existing = state.comments.get(action.key)?.text;
      let initialText = existing ?? action.quotedText ?? "";
      if (existing !== undefined && action.quotedText !== undefined) {
        initialText = insertQuote(existing, existing.length, action.quotedText).text;
      }
      const editing = new Map(state.editing);
      editing.set(action.key, initialText);
      return { ...state, editing, activeKey: action.key };
    }
    case "activate": {
      if (!state.editing.has(action.key) || state.activeKey === action.key) return state;
      return { ...state, activeKey: action.key };
    }
    case "cancel":
      return closeEditor(state, action.key);
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
      return closeEditor({ ...state, comments: next }, action.key);
    }
    case "delete": {
      if (!state.comments.has(action.key)) return state;
      const next = new Map(state.comments);
      next.delete(action.key);
      return closeEditor({ ...state, comments: next }, action.key);
    }
    case "deleteAll": {
      if (state.comments.size === 0 && state.outdated.length === 0) return state;
      return {
        comments: new Map(),
        outdated: [],
        editing: new Map(),
        activeKey: null,
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
 * entries: 指定されたファイルの一覧。コピーするときはこの順に並べる
 */
export function useComments(
  relPath: string,
  filePath: string,
  source: string,
  entries: EntryFile[],
) {
  const [state, dispatch] = useReducer(commentsReducer, undefined, (): CommentsState => {
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
      editing: new Map(),
      activeKey: null,
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

  const activateEditor = useCallback((key: string) => dispatch({ type: "activate", key }), []);

  const cancelEditing = useCallback((key: string) => dispatch({ type: "cancel", key }), []);

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

  const stores = useMemo<CommentStore[]>(
    () => [{ relPath, filePath, comments: state.comments }, ...otherStores],
    [relPath, filePath, state.comments, otherStores],
  );

  // 指定されたファイルを指定された順に並べ、リンクを辿った先のファイルはその後ろにパス順で続ける。
  // どのファイルを開いてコピーしても同じ並びになるので、AIへ渡す文面が安定する。
  const commentGroups = useMemo<CommentGroup[]>(() => {
    const order = new Map(entries.map((entry, index) => [entry.relPath, index]));
    const rank = (store: CommentStore) => order.get(store.relPath) ?? entries.length;
    return stores
      .filter((store) => store.comments.size > 0)
      .sort((a, b) => rank(a) - rank(b) || a.relPath.localeCompare(b.relPath))
      .map((store) => ({
        filePath: store.filePath,
        comments: Array.from(store.comments.values()),
      }));
  }, [stores, entries]);

  /** ファイル一覧のバッジに出す、ファイルごとのコメント数(relPathで引く) */
  const commentCounts = useMemo(
    () => new Map(stores.map((store) => [store.relPath, store.comments.size])),
    [stores],
  );

  const otherFileCount = otherStores.reduce((total, store) => total + store.comments.size, 0);

  return {
    comments: state.comments,
    outdatedComments: state.outdated,
    /** 開いているエディタのキーと、それぞれの初期テキスト */
    editing: state.editing,
    activeKey: state.activeKey,
    pendingQuote: state.pendingQuote,
    /** コピー対象。表示中のファイルと、リンク先で書いたコメントを合わせたもの */
    commentGroups,
    /** 表示中のファイル以外に残っているコメントの数 */
    otherFileCount,
    commentCounts,
    openEditor,
    activateEditor,
    cancelEditing,
    save,
    deleteComment,
    deleteAllComments,
    clearOutdatedComments,
  };
}
