export const cursorLineClientScript = `
(() => {
  const CANDIDATE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,tr,pre .line,hr";
  const PRIORITY = {
    H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0,
    SPAN: 1, TR: 2, LI: 3, BLOCKQUOTE: 4, HR: 5, P: 6,
  };
  const CURSOR_ATTR = "data-mdecho-cursor";
  const STORAGE_KEY = "mdecho:cursorLine";

  let targets = [];
  let cursorIndex = -1;

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function pickWinner(group) {
    if (group.length === 1) return group[0];
    return group.slice().sort((a, b) => {
      const pa = PRIORITY[a.tagName] ?? 99;
      const pb = PRIORITY[b.tagName] ?? 99;
      if (pa !== pb) return pa - pb;
      if (a.contains(b)) return -1;
      if (b.contains(a)) return 1;
      return 0;
    })[0];
  }

  function collectTargets(root) {
    const all = Array.from(root.querySelectorAll(CANDIDATE_SELECTOR)).filter((el) =>
      el.hasAttribute("data-line"),
    );

    const byLine = new Map();
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

  function setCursor(index) {
    if (targets.length === 0) return;
    const clamped = Math.max(0, Math.min(index, targets.length - 1));
    if (cursorIndex >= 0 && targets[cursorIndex]) {
      targets[cursorIndex].removeAttribute(CURSOR_ATTR);
    }
    cursorIndex = clamped;
    const el = targets[cursorIndex];
    el.setAttribute(CURSOR_ATTR, "");
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    try {
      sessionStorage.setItem(STORAGE_KEY, el.getAttribute("data-line") ?? "");
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }
  }

  function moveCursor(delta) {
    if (cursorIndex === -1) {
      setCursor(0);
      return;
    }
    setCursor(cursorIndex + delta);
  }

  function restoreInitialCursor() {
    let storedLine = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw !== null) storedLine = Number(raw);
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }

    if (storedLine !== null && !Number.isNaN(storedLine)) {
      const idx = targets.findIndex((el) => Number(el.getAttribute("data-line")) >= storedLine);
      setCursor(idx === -1 ? targets.length - 1 : idx);
      return;
    }
    setCursor(0);
  }

  function handleKeydown(event) {
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

  function getTargetForElement(el) {
    if (!el) return null;
    const container = el.closest(CANDIDATE_SELECTOR);
    if (!container) return null;
    const line = Number(container.getAttribute("data-line"));
    return targets.find((t) => Number(t.getAttribute("data-line")) === line) ?? null;
  }

  window.mdechoCursor = {
    getCurrentTarget: () => targets[cursorIndex] ?? null,
    getTargetByLine: (line) =>
      targets.find((el) => Number(el.getAttribute("data-line")) === line) ?? null,
    getTargetForElement,
    getTargets: () => targets.slice(),
    setCursorToElement: (el) => {
      const idx = targets.indexOf(el);
      if (idx !== -1) setCursor(idx);
    },
  };

  function init() {
    const root = document.querySelector(".markdown-body");
    if (!root) return;
    targets = collectTargets(root);
    if (targets.length === 0) return;
    restoreInitialCursor();
    document.addEventListener("keydown", handleKeydown);
  }

  init();
})();
`;
