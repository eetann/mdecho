export const commentClientScript = `
(() => {
  const STORAGE_KEY = "mdecho:comments";
  const MIN_TEXTAREA_ROWS = 3;

  let comments = new Map();
  let editingLine = null;

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function loadComments() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        comments = new Map(JSON.parse(raw));
      }
    } catch {
      // sessionStorageが使えない、または壊れたデータは無視
    }
  }

  function persistComments() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(comments.entries())));
    } catch {
      // sessionStorageが使えない環境(プライベートブラウジング等)は無視
    }
  }

  function findSlotRoot(line) {
    return document.querySelector('[data-mdecho-comment-slot="' + line + '"]');
  }

  function getContentHost(slotRoot) {
    return slotRoot.tagName === "TR" ? slotRoot.querySelector("td") : slotRoot;
  }

  function createSlotRoot(target, line) {
    if (target.tagName === "TR") {
      const row = document.createElement("tr");
      row.className = "mdecho-comment-row";
      row.setAttribute("data-mdecho-comment-slot", String(line));
      const td = document.createElement("td");
      td.colSpan = target.children.length || 1;
      row.appendChild(td);
      target.insertAdjacentElement("afterend", row);
      return row;
    }
    const div = document.createElement("div");
    div.className = "mdecho-comment-slot";
    div.setAttribute("data-mdecho-comment-slot", String(line));
    target.insertAdjacentElement("afterend", div);
    return div;
  }

  function ensureSlotRoot(target, line) {
    return findSlotRoot(line) ?? createSlotRoot(target, line);
  }

  function removeSlot(line) {
    const slot = findSlotRoot(line);
    if (slot) slot.remove();
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * MIN_TEXTAREA_ROWS;
    textarea.style.height = Math.max(minHeight, textarea.scrollHeight) + "px";
  }

  function renderView(host, line, text) {
    host.innerHTML = "";
    const view = document.createElement("div");
    view.className = "mdecho-comment-view";

    const label = document.createElement("span");
    label.className = "mdecho-comment-view-label";
    label.textContent = "\u{1F4AC}";

    const body = document.createElement("span");
    body.className = "mdecho-comment-view-body";
    body.textContent = text;

    view.appendChild(label);
    view.appendChild(body);
    host.appendChild(view);
  }

  function renderEditor(host, line, initialText) {
    host.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "mdecho-comment-editor";

    const textarea = document.createElement("textarea");
    textarea.className = "mdecho-comment-textarea";
    textarea.rows = MIN_TEXTAREA_ROWS;
    textarea.value = initialText;

    const actions = document.createElement("div");
    actions.className = "mdecho-comment-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "mdecho-comment-cancel";
    cancelBtn.textContent = "cancel";
    cancelBtn.addEventListener("click", () => cancelEdit(line));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "mdecho-comment-save";
    saveBtn.textContent = "save";
    saveBtn.addEventListener("click", () => commitSave(line, textarea.value));

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    textarea.addEventListener("input", () => autoGrow(textarea));
    textarea.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        commitSave(line, textarea.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit(line);
      }
    });

    wrapper.appendChild(textarea);
    wrapper.appendChild(actions);
    host.appendChild(wrapper);

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autoGrow(textarea);
  }

  function openEditor(target) {
    const line = Number(target.getAttribute("data-line"));
    if (editingLine === line) return;
    if (editingLine !== null) {
      cancelEdit(editingLine);
    }
    const slot = ensureSlotRoot(target, line);
    const host = getContentHost(slot);
    const initialText = comments.get(line) ?? "";
    editingLine = line;
    renderEditor(host, line, initialText);
  }

  function cancelEdit(line) {
    if (editingLine === line) editingLine = null;
    const existingText = comments.get(line);
    if (existingText !== undefined) {
      const slot = findSlotRoot(line);
      if (slot) renderView(getContentHost(slot), line, existingText);
    } else {
      removeSlot(line);
    }
  }

  function commitSave(line, rawText) {
    const text = rawText.trim();
    editingLine = null;
    if (text === "") {
      comments.delete(line);
      removeSlot(line);
    } else {
      comments.set(line, text);
      const target = window.mdechoCursor.getTargetByLine(line);
      const slot = target ? ensureSlotRoot(target, line) : findSlotRoot(line);
      if (slot) renderView(getContentHost(slot), line, text);
    }
    persistComments();
    updateCopyButtonState();
  }

  function restoreAllViews() {
    for (const [line, text] of comments) {
      const target = window.mdechoCursor.getTargetByLine(line);
      if (!target) continue;
      const slot = ensureSlotRoot(target, line);
      renderView(getContentHost(slot), line, text);
    }
  }

  function updateCopyButtonState() {
    const button = document.getElementById("mdecho-copy-button");
    if (!button) return;
    button.disabled = comments.size === 0;
  }

  function buildClipboardText() {
    const filePath = window.__MDECHO_FILE_PATH__ ?? "";
    return Array.from(comments.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([line, text]) => filePath + ":L" + line + "\\n" + text)
      .join("\\n\\n---\\n\\n");
  }

  async function handleCopyClick() {
    const button = document.getElementById("mdecho-copy-button");
    if (!button || comments.size === 0) return;
    const text = buildClipboardText();
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied!";
    } catch {
      button.textContent = "Copy failed";
    }
    setTimeout(() => {
      button.textContent = "Copy";
    }, 1500);
  }

  function handleGlobalKeydown(event) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditableTarget(document.activeElement)) return;
    if (event.key !== "Enter") return;
    const target = window.mdechoCursor.getCurrentTarget();
    if (target) {
      event.preventDefault();
      openEditor(target);
    }
  }

  function handleDocumentClick(event) {
    if (event.target.closest(".mdecho-comment-editor")) return;
    if (event.target.closest(".mdecho-toolbar")) return;

    const viewEl = event.target.closest(".mdecho-comment-view");
    if (viewEl) {
      const slot = viewEl.closest("[data-mdecho-comment-slot]");
      const line = Number(slot?.getAttribute("data-mdecho-comment-slot"));
      const target = window.mdechoCursor.getTargetByLine(line);
      if (target) openEditor(target);
      return;
    }

    const target = window.mdechoCursor.getTargetForElement(event.target);
    if (target) {
      window.mdechoCursor.setCursorToElement(target);
      openEditor(target);
    }
  }

  function init() {
    if (!window.mdechoCursor) return;
    loadComments();
    restoreAllViews();
    updateCopyButtonState();
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("click", handleDocumentClick);
    document.getElementById("mdecho-copy-button")?.addEventListener("click", handleCopyClick);
  }

  init();
})();
`;
