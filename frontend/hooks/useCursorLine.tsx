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
} from "react";
import { comparePriority } from "../lib/cursor-priority.ts";
import { findRestoreIndex, formatCursorKey, parseCursorKey } from "../lib/cursor-restore.ts";
import { computeLineParts, groupIndexAt, positionOfGroupIndex } from "../lib/line-group.ts";

const CANDIDATE_SELECTOR =
  "h1,h2,h3,h4,h5,h6,p,li,blockquote,tr,pre .line,hr,.mdecho-sentence,.mdecho-mermaid";
const CURSOR_ATTR = "data-mdecho-cursor";
const STORAGE_KEY = "mdecho:cursorLine";

export interface CursorLineApi {
  targets: Element[];
  getCurrentTarget: () => Element | null;
  getTargetByLine: (line: number) => Element | null;
  getTargetByLineAndSentence: (line: number, sentenceIndex: number) => Element | null;
  getSentenceIndex: (el: Element) => number;
  getTargetForElement: (el: Element | null) => Element | null;
  setCursorToElement: (el: Element) => void;
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
  // それらを子孫に持つ祖先(分割された段落の<p>自身など)は、既存のグルーピング対象から除外する。
  const sentences = all.filter((el) => el.classList.contains("mdecho-sentence"));
  const rest = all.filter(
    (el) =>
      !el.classList.contains("mdecho-sentence") && el.querySelector(".mdecho-sentence") === null,
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
  children,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const [targets, setTargets] = useState<Element[]>([]);
  const targetsRef = useRef<Element[]>([]);
  const cursorIndexRef = useRef(-1);

  const setCursor = useCallback((index: number) => {
    const currentTargets = targetsRef.current;
    if (currentTargets.length === 0) return;
    const clamped = Math.max(0, Math.min(index, currentTargets.length - 1));
    const previous = currentTargets[cursorIndexRef.current];
    if (cursorIndexRef.current >= 0 && previous) {
      previous.removeAttribute(CURSOR_ATTR);
    }
    cursorIndexRef.current = clamped;
    const el = currentTargets[clamped];
    if (!el) return;
    el.setAttribute(CURSOR_ATTR, "");
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    try {
      const line = Number(el.getAttribute("data-line"));
      const lines = currentTargets.map((t) => Number(t.getAttribute("data-line")));
      const part = groupIndexAt(lines, clamped);
      sessionStorage.setItem(STORAGE_KEY, formatCursorKey(line, part));
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }
  }, []);

  const moveCursor = useCallback(
    (delta: number) => {
      if (cursorIndexRef.current === -1) {
        setCursor(0);
        return;
      }
      setCursor(cursorIndexRef.current + delta);
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

    let stored: ReturnType<typeof parseCursorKey> = null;
    try {
      stored = parseCursorKey(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }
    const lines = collected.map((el) => Number(el.getAttribute("data-line")));
    const parts = computeLineParts(lines);
    const restoreIndex = findRestoreIndex(lines, parts, stored);
    setCursor(restoreIndex === -1 ? 0 : restoreIndex);

    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(document.activeElement)) return;

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        moveCursor(1);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        moveCursor(-1);
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [markdownBodyRef, setCursor, moveCursor]);

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

  const api = useMemo<CursorLineApi>(
    () => ({
      targets,
      getCurrentTarget,
      getTargetByLine,
      getTargetByLineAndSentence,
      getSentenceIndex,
      getTargetForElement,
      setCursorToElement,
    }),
    [
      targets,
      getCurrentTarget,
      getTargetByLine,
      getTargetByLineAndSentence,
      getSentenceIndex,
      getTargetForElement,
      setCursorToElement,
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
