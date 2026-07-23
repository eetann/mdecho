export const commentClientScript = `
(() => {
  const STORAGE_KEY = "mdecho:comments";
  const MIN_TEXTAREA_ROWS = 3;

  let comments = new Map();
  let editingKey = null;
  let pendingSelection = null;
  let replyButton = null;

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function keyOf(startLine, endLine) {
    return startLine + "-" + endLine;
  }

  function parseKey(key) {
    const [startLine, endLine] = key.split("-").map(Number);
    return { startLine, endLine };
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

  function findSlotRoot(key) {
    return document.querySelector('[data-mdecho-comment-slot="' + key + '"]');
  }

  function getContentHost(slotRoot) {
    return slotRoot.tagName === "TR" ? slotRoot.querySelector("td") : slotRoot;
  }

  function createSlotRoot(target, key) {
    if (target.tagName === "TR") {
      const row = document.createElement("tr");
      row.className = "mdecho-comment-row";
      row.setAttribute("data-mdecho-comment-slot", key);
      const td = document.createElement("td");
      td.colSpan = target.children.length || 1;
      row.appendChild(td);
      target.insertAdjacentElement("afterend", row);
      return row;
    }
    const div = document.createElement("div");
    div.className = "mdecho-comment-slot";
    div.setAttribute("data-mdecho-comment-slot", key);
    target.insertAdjacentElement("afterend", div);
    return div;
  }

  function ensureSlotRoot(target, key) {
    return findSlotRoot(key) ?? createSlotRoot(target, key);
  }

  function removeSlot(key) {
    const slot = findSlotRoot(key);
    if (slot) slot.remove();
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * MIN_TEXTAREA_ROWS;
    textarea.style.height = Math.max(minHeight, textarea.scrollHeight) + "px";
  }

  function renderView(host, key, text) {
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

  function renderEditor(host, key, initialText) {
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
    cancelBtn.addEventListener("click", () => cancelEdit(key));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "mdecho-comment-save";
    saveBtn.textContent = "save";
    saveBtn.addEventListener("click", () => commitSave(key, textarea.value));

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    textarea.addEventListener("input", () => autoGrow(textarea));
    textarea.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        commitSave(key, textarea.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit(key);
      }
    });

    wrapper.appendChild(textarea);
    wrapper.appendChild(actions);
    host.appendChild(wrapper);

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autoGrow(textarea);
  }

  function buildInitialCommentText(selectedText) {
    const trimmed = selectedText.replace(/\\n+$/, "");
    if (!trimmed.includes("\\n")) {
      return "\`" + trimmed + "\`";
    }
    return (
      trimmed
        .split("\\n")
        .map((line) => "> " + line)
        .join("\\n") + "\\n\\n"
    );
  }

  function openEditor(target) {
    const line = Number(target.getAttribute("data-line"));
    openEditorForRange(target, line, line, null);
  }

  function openEditorForRange(target, startLine, endLine, selectedText) {
    const key = keyOf(startLine, endLine);
    if (editingKey === key) return;
    if (editingKey !== null) {
      cancelEdit(editingKey);
    }
    const slot = ensureSlotRoot(target, key);
    const host = getContentHost(slot);
    const existing = comments.get(key);
    const initialText = existing
      ? existing.text
      : selectedText
        ? buildInitialCommentText(selectedText)
        : "";
    editingKey = key;
    renderEditor(host, key, initialText);
  }

  function cancelEdit(key) {
    if (editingKey === key) editingKey = null;
    const existing = comments.get(key);
    if (existing !== undefined) {
      const slot = findSlotRoot(key);
      if (slot) renderView(getContentHost(slot), key, existing.text);
    } else {
      removeSlot(key);
    }
  }

  function commitSave(key, rawText) {
    const text = rawText.trim();
    editingKey = null;
    const { startLine, endLine } = parseKey(key);
    if (text === "") {
      comments.delete(key);
      removeSlot(key);
    } else {
      comments.set(key, { startLine, endLine, text });
      const target = window.mdechoCursor.getTargetByLine(endLine);
      const slot = target ? ensureSlotRoot(target, key) : findSlotRoot(key);
      if (slot) renderView(getContentHost(slot), key, text);
    }
    persistComments();
    updateCopyButtonState();
  }

  function restoreAllViews() {
    for (const [key, { endLine, text }] of comments) {
      const target = window.mdechoCursor.getTargetByLine(endLine);
      if (!target) continue;
      const slot = ensureSlotRoot(target, key);
      renderView(getContentHost(slot), key, text);
    }
  }

  function updateCopyButtonState() {
    const button = document.getElementById("mdecho-copy-button");
    if (!button) return;
    button.disabled = comments.size === 0;
  }

  function buildClipboardText() {
    const filePath = window.__MDECHO_FILE_PATH__ ?? "";
    return Array.from(comments.values())
      .sort((a, b) => a.startLine - b.startLine)
      .map(({ startLine, endLine, text }) => {
        const ref = startLine === endLine ? "L" + startLine : "L" + startLine + "-L" + endLine;
        return filePath + ":" + ref + "\\n" + text;
      })
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
    if (event.target.closest(".mdecho-reply-button")) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim() !== "") return;

    const viewEl = event.target.closest(".mdecho-comment-view");
    if (viewEl) {
      const slot = viewEl.closest("[data-mdecho-comment-slot]");
      const key = slot?.getAttribute("data-mdecho-comment-slot");
      const { startLine, endLine } = parseKey(key);
      const target = window.mdechoCursor.getTargetByLine(endLine);
      if (target) openEditorForRange(target, startLine, endLine, null);
      return;
    }

    const target = window.mdechoCursor.getTargetForElement(event.target);
    if (target) {
      window.mdechoCursor.setCursorToElement(target);
      openEditor(target);
    }
  }

  function resolveSelectionRange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const text = selection.toString();
    if (text.trim() === "") return null;

    const range = selection.getRangeAt(0);
    const startEl =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;
    const endEl =
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : range.endContainer;

    const startTarget = window.mdechoCursor.getTargetForElement(startEl);
    const endTarget = window.mdechoCursor.getTargetForElement(endEl);
    if (!startTarget || !endTarget) return null;

    const startLine = Number(startTarget.getAttribute("data-line"));
    const endLine = Number(endTarget.getAttribute("data-line-end") ?? endTarget.getAttribute("data-line"));
    const rect = range.getBoundingClientRect();

    return { startLine, endLine, endTarget, text, rect };
  }

  function ensureReplyButton() {
    if (replyButton) return replyButton;
    replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.id = "mdecho-reply-button";
    replyButton.className = "mdecho-reply-button";
    replyButton.textContent = "返信";
    replyButton.addEventListener("mousedown", (event) => event.preventDefault());
    replyButton.addEventListener("click", handleReplyButtonClick);
    document.body.appendChild(replyButton);
    return replyButton;
  }

  function hideReplyButton() {
    if (replyButton) replyButton.classList.remove("mdecho-reply-button-visible");
  }

  function handleSelectionChange() {
    const resolved = resolveSelectionRange();
    const button = ensureReplyButton();
    if (!resolved) {
      hideReplyButton();
      pendingSelection = null;
      return;
    }
    pendingSelection = resolved;
    const rect = resolved.rect;
    button.style.top = Math.max(8, rect.top - 40) + window.scrollY + "px";
    button.style.left = rect.left + window.scrollX + "px";
    button.classList.add("mdecho-reply-button-visible");
  }

  function handleReplyButtonClick() {
    if (!pendingSelection) return;
    const { startLine, endLine, endTarget, text } = pendingSelection;
    hideReplyButton();
    window.getSelection()?.removeAllRanges();
    openEditorForRange(endTarget, startLine, endLine, text);
  }

  function init() {
    if (!window.mdechoCursor) return;
    loadComments();
    restoreAllViews();
    updateCopyButtonState();
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.getElementById("mdecho-copy-button")?.addEventListener("click", handleCopyClick);
  }

  init();
})();
`;
