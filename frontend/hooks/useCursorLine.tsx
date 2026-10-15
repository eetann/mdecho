import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { comparePriority } from "../lib/cursor-priority.ts";
import { findRestoreIndex, formatCursorKey, parseCursorKey } from "../lib/cursor-restore.ts";
import { clampToCursorScope, findCursorScope } from "../lib/cursor-scope.ts";
import { computeLineParts, groupIndexAt, positionOfGroupIndex } from "../lib/line-group.ts";
import { getOpenTableModal, isDialogOpen } from "../lib/modal.ts";
import { excludeLinesCoveredBySentences } from "../lib/sentence-cover.ts";
import { useScrollRestore } from "./useScrollRestore.ts";

const CANDIDATE_SELECTOR =
  "h1,h2,h3,h4,h5,h6,p,li,blockquote,tr,pre .line,hr,.mdecho-sentence,.mdecho-mermaid";
const CURSOR_ATTR = "data-mdecho-cursor";
// ファイルをまたいで読み進められるため、カーソル位置も表示中のファイルごとに分けて持つ。
const STORAGE_KEY_PREFIX = "mdecho:cursorLine:";

export interface CursorLineApi {
  targets: Element[];
  getCurrentTarget: () => Element | null;
  getTargetByLine: (line: number) => Element | null;
  getTargetByLineAndSentence: (line: number, sentenceIndex: number) => Element | null;
  getSentenceIndex: (el: Element) => number;
  getTargetForElement: (el: Element | null) => Element | null;
  setCursorToElement: (el: Element) => void;
  /** カーソルがtargetsの何番目にいるかを読む。まだ決まっていなければ-1 */
  getCursorIndex: () => number;
  /** カーソルが動いたときに呼ばれるリスナーを登録する。戻り値で解除する */
  subscribeCursorIndex: (listener: () => void) => () => void;
}

const CursorLineContext = createContext<CursorLineApi | null>(null);

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

/** URLのフラグメントが指す見出しがtargetsの何番目かを返す。無ければ-1 */
function findHashIndex(targets: readonly Element[]): number {
  const raw = location.hash.slice(1);
  if (raw === "") return -1;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    id = raw;
  }
  return targets.findIndex((el) => el.id === id);
}

function pickWinner(group: Element[]): Element {
  if (group.length === 1) {
    return group[0] as Element;
  }
  const sorted = group.slice().sort((a, b) => {
    const priority = comparePriority(a.tagName, b.tagName);
    if (priority !== 0) return priority;
    if (a.contains(b)) return -1;
    if (b.contains(a)) return 1;
    return 0;
  });
  return sorted[0] as Element;
}

function collectTargets(root: Element): Element[] {
  const all = Array.from(root.querySelectorAll(CANDIDATE_SELECTOR)).filter((el) =>
    el.hasAttribute("data-line"),
  );

  // 句点分割された文(.mdecho-sentence)はそれぞれ個別targetとして扱う。
  // 文と同じ行にある要素(分割された段落の<p>自身など)は、既存のグルーピング対象から除外する。
  const sentences = all.filter((el) => el.classList.contains("mdecho-sentence"));
  const sentenceLines = new Set(sentences.map((el) => Number(el.getAttribute("data-line"))));
  const rest = excludeLinesCoveredBySentences(
    all.filter((el) => !el.classList.contains("mdecho-sentence")),
    sentenceLines,
    (el) => Number(el.getAttribute("data-line")),
  );

  const byLine = new Map<number, Element[]>();
  for (const el of rest) {
    const line = Number(el.getAttribute("data-line"));
    const group = byLine.get(line);
    if (group) {
      group.push(el);
    } else {
      byLine.set(line, [el]);
    }
  }

  const winners = Array.from(byLine.values()).map(pickWinner);

  return [...winners, ...sentences].sort(
    (a, b) => Number(a.getAttribute("data-line")) - Number(b.getAttribute("data-line")),
  );
}

export function CursorLineProvider({
  markdownBodyRef,
  relPath,
  children,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
  /** Markdownのあるディレクトリを起点にした、表示中ファイルの相対パス(保存キーに使う) */
  relPath: string;
  children: ReactNode;
}) {
  const [targets, setTargets] = useState<Element[]>([]);
  const targetsRef = useRef<Element[]>([]);
  const cursorIndexRef = useRef(-1);
  // カーソルの移動でProvider全体を再描画すると、行数ぶんの要素を持つ行番号ガターまで
  // 巻き込まれる。カーソル位置を知りたいものだけが再描画されるよう、購読の形で配る。
  const cursorListenersRef = useRef(new Set<() => void>());

  const setCursor = useCallback(
    (index: number, scrollBlock: ScrollLogicalPosition = "nearest") => {
      const currentTargets = targetsRef.current;
      if (currentTargets.length === 0) return;
      const clamped = Math.max(0, Math.min(index, currentTargets.length - 1));
      const previous = currentTargets[cursorIndexRef.current];
      if (cursorIndexRef.current >= 0 && previous) {
        previous.removeAttribute(CURSOR_ATTR);
      }
      cursorIndexRef.current = clamped;
      const el = currentTargets[clamped];
      if (el) {
        el.setAttribute(CURSOR_ATTR, "");
        el.scrollIntoView({ block: scrollBlock, inline: "nearest" });
        try {
          const line = Number(el.getAttribute("data-line"));
          const lines = currentTargets.map((t) => Number(t.getAttribute("data-line")));
          const part = groupIndexAt(lines, clamped);
          sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${relPath}`, formatCursorKey(line, part));
        } catch {
          // sessionStorageが使えない環境(プライベートブラウジング等)は無視
        }
      }
      for (const listener of cursorListenersRef.current) listener();
    },
    [relPath],
  );

  const moveCursor = useCallback(
    (delta: number) => {
      // 表を拡大している間は、その中の行だけを行き来する。外の行はモーダルの裏に隠れていて、
      // 送っても動いたことが分からない。
      const modal = getOpenTableModal();
      const scope = modal
        ? findCursorScope(targetsRef.current.map((el) => modal.contains(el)))
        : null;
      if (modal && !scope) return;
      if (cursorIndexRef.current === -1) {
        setCursor(scope ? scope.start : 0);
        return;
      }
      const next = cursorIndexRef.current + delta;
      setCursor(scope ? clampToCursorScope(next, scope) : next);
    },
    [setCursor],
  );

  useLayoutEffect(() => {
    const root = markdownBodyRef.current;
    if (!root) return;

    const collected = collectTargets(root);
    targetsRef.current = collected;
    setTargets(collected);
    if (collected.length === 0) return;

    // 目次から共有された`#見出し`付きのURLで開いたときは、そこをカーソル位置にする。
    // 本文はReactがマウントしてから描画するため、ブラウザ自身のフラグメント移動は間に合わない。
    const hashIndex = findHashIndex(collected);
    if (hashIndex === -1) {
      let stored: ReturnType<typeof parseCursorKey> = null;
      try {
        stored = parseCursorKey(sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${relPath}`));
      } catch {
        // sessionStorageが使えない環境(プライベートブラウジング等)は無視
      }
      const lines = collected.map((el) => Number(el.getAttribute("data-line")));
      const parts = computeLineParts(lines);
      const restoreIndex = findRestoreIndex(lines, parts, stored);
      setCursor(restoreIndex === -1 ? 0 : restoreIndex);
    } else {
      // 共有リンクを開いた直後は見出しが画面外なので、"nearest"ではなく先頭に寄せる。
      setCursor(hashIndex, "start");
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(document.activeElement)) return;
      // 表の拡大表示だけは、開いている間もj/kを生かす(moveCursorが表の中に閉じ込める)
      if (isDialogOpen()) return;

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        moveCursor(1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        moveCursor(-1);
      }
    }

    function handleHashChange() {
      const index = findHashIndex(targetsRef.current);
      // スクロールはブラウザが済ませているので、ここではカーソルだけ合わせる。
      if (index !== -1) setCursor(index);
    }

    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [markdownBodyRef, relPath, setCursor, moveCursor]);

  // targetsが揃ってから動くよう、上のeffectより後に置く。カーソルの復元が寄せたスクロールを、
  // このフックが読んでいた位置へ置き直す。
  useScrollRestore(relPath, targets);

  const getCurrentTarget = useCallback(
    () => targetsRef.current[cursorIndexRef.current] ?? null,
    [],
  );
  const getTargetByLine = useCallback(
    (line: number) =>
      targetsRef.current.find((el) => Number(el.getAttribute("data-line")) === line) ?? null,
    [],
  );
  const getTargetByLineAndSentence = useCallback((line: number, sentenceIndex: number) => {
    const lines = targetsRef.current.map((el) => Number(el.getAttribute("data-line")));
    const position = positionOfGroupIndex(lines, line, sentenceIndex);
    return position === null ? null : (targetsRef.current[position] ?? null);
  }, []);
  const getSentenceIndex = useCallback((el: Element) => {
    const position = targetsRef.current.indexOf(el);
    if (position === -1) return 0;
    const lines = targetsRef.current.map((t) => Number(t.getAttribute("data-line")));
    return groupIndexAt(lines, position);
  }, []);
  const getTargetForElement = useCallback((el: Element | null) => {
    if (!el) return null;
    const container = el.closest(CANDIDATE_SELECTOR);
    if (!container) return null;
    if (targetsRef.current.includes(container)) return container;
    const line = Number(container.getAttribute("data-line"));
    return targetsRef.current.find((t) => Number(t.getAttribute("data-line")) === line) ?? null;
  }, []);
  const setCursorToElement = useCallback(
    (el: Element) => {
      const idx = targetsRef.current.indexOf(el);
      if (idx !== -1) setCursor(idx);
    },
    [setCursor],
  );
  const getCursorIndex = useCallback(() => cursorIndexRef.current, []);
  const subscribeCursorIndex = useCallback((listener: () => void) => {
    const listeners = cursorListenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const api = useMemo<CursorLineApi>(
    () => ({
      targets,
      getCurrentTarget,
      getTargetByLine,
      getTargetByLineAndSentence,
      getSentenceIndex,
      getTargetForElement,
      setCursorToElement,
      getCursorIndex,
      subscribeCursorIndex,
    }),
    [
      targets,
      getCurrentTarget,
      getTargetByLine,
      getTargetByLineAndSentence,
      getSentenceIndex,
      getTargetForElement,
      setCursorToElement,
      getCursorIndex,
      subscribeCursorIndex,
    ],
  );

  return <CursorLineContext.Provider value={api}>{children}</CursorLineContext.Provider>;
}

export function useCursorLine(): CursorLineApi {
  const ctx = useContext(CursorLineContext);
  if (!ctx) {
    throw new Error("useCursorLine must be used within a CursorLineProvider");
  }
  return ctx;
}

/**
 * カーソルがtargetsの何番目にいるかを、移動に追従して返す。まだ決まっていなければ-1。
 * これを呼んだコンポーネントだけがカーソルの移動で再描画される。
 */
export function useCursorIndex(): number {
  const { getCursorIndex, subscribeCursorIndex } = useCursorLine();
  return useSyncExternalStore(subscribeCursorIndex, getCursorIndex);
}
