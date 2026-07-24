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
import { findRestoreIndex } from "../lib/cursor-restore.ts";

const CANDIDATE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,tr,pre .line,hr";
const CURSOR_ATTR = "data-mdecho-cursor";
const STORAGE_KEY = "mdecho:cursorLine";

export interface CursorLineApi {
  targets: Element[];
  getCurrentTarget: () => Element | null;
  getTargetByLine: (line: number) => Element | null;
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

  const byLine = new Map<number, Element[]>();
  for (const el of all) {
    const line = Number(el.getAttribute("data-line"));
    const group = byLine.get(line);
    if (group) {
      group.push(el);
    } else {
      byLine.set(line, [el]);
    }
  }

  return Array.from(byLine.values())
    .map(pickWinner)
    .sort((a, b) => Number(a.getAttribute("data-line")) - Number(b.getAttribute("data-line")));
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
      sessionStorage.setItem(STORAGE_KEY, el.getAttribute("data-line") ?? "");
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

    let storedLine: number | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw !== null) storedLine = Number(raw);
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }
    const restoreIndex = findRestoreIndex(
      collected.map((el) => Number(el.getAttribute("data-line"))),
      storedLine,
    );
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
  const getTargetForElement = useCallback((el: Element | null) => {
    if (!el) return null;
    const container = el.closest(CANDIDATE_SELECTOR);
    if (!container) return null;
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
    () => ({ targets, getCurrentTarget, getTargetByLine, getTargetForElement, setCursorToElement }),
    [targets, getCurrentTarget, getTargetByLine, getTargetForElement, setCursorToElement],
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
