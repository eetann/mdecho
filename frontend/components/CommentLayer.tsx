import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCommentSlots } from "../hooks/useCommentSlots.ts";
import { useCursorLine } from "../hooks/useCursorLine.tsx";
import { parseKey } from "../lib/comment-keys.ts";
import type { Comment } from "../lib/types.ts";
import { CommentSlot } from "./CommentSlot.tsx";
import { QuoteButton } from "./QuoteButton.tsx";

const CLICK_TO_EDIT_DELAY_MS = 300;

interface PendingSelection {
  startLine: number;
  endLine: number;
  endTarget: Element;
  text: string;
  rect: DOMRect;
}

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

function hasActiveTextSelection(): boolean {
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && selection.toString().trim() !== "";
}

export function CommentLayer({
  comments,
  editingKey,
  editingInitialText,
  openEditor,
  cancelEditing,
  save,
  deleteComment,
}: {
  comments: Map<string, Comment>;
  editingKey: string | null;
  editingInitialText: string;
  openEditor: (startLine: number, endLine: number, selectedText?: string) => void;
  cancelEditing: () => void;
  save: (key: string, text: string) => void;
  deleteComment: (key: string) => void;
}) {
  const cursor = useCursorLine();

  const visibleKeys = useMemo(() => {
    const keys = new Set(comments.keys());
    if (editingKey !== null) keys.add(editingKey);
    return Array.from(keys);
  }, [comments, editingKey]);

  const contentHosts = useCommentSlots(visibleKeys, cursor.getTargetByLine, cursor.targets);

  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const pendingClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function cancelPendingClick() {
      if (pendingClickTimerRef.current !== null) {
        clearTimeout(pendingClickTimerRef.current);
        pendingClickTimerRef.current = null;
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      cancelPendingClick();

      const eventTarget = event.target as Element | null;
      if (eventTarget?.closest(".mdecho-comment-editor")) return;
      if (eventTarget?.closest(".mdecho-toolbar")) return;
      if (eventTarget?.closest(".mdecho-reply-button")) return;
      if (hasActiveTextSelection()) return;

      const viewEl = eventTarget?.closest(".mdecho-comment-view");
      if (viewEl) {
        const slot = viewEl.closest("[data-mdecho-comment-slot]");
        const key = slot?.getAttribute("data-mdecho-comment-slot");
        if (!key) return;
        const { startLine, endLine } = parseKey(key);
        const target = cursor.getTargetByLine(endLine);
        if (target) openEditor(startLine, endLine);
        return;
      }

      const target = cursor.getTargetForElement(eventTarget);
      if (!target) return;

      // ダブル/トリプルクリックの1回目かどうかこの時点では区別できないため、
      // 少し待って文字選択が確定していないか再確認してから開く。
      pendingClickTimerRef.current = setTimeout(() => {
        pendingClickTimerRef.current = null;
        if (hasActiveTextSelection()) return;
        cursor.setCursorToElement(target);
        const line = Number(target.getAttribute("data-line"));
        openEditor(line, line);
      }, CLICK_TO_EDIT_DELAY_MS);
    }

    function handleGlobalKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(document.activeElement)) return;
      if (event.key !== "Enter") return;
      const target = cursor.getCurrentTarget();
      if (target) {
        event.preventDefault();
        const line = Number(target.getAttribute("data-line"));
        openEditor(line, line);
      }
    }

    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setPendingSelection(null);
        return;
      }
      const text = selection.toString();
      if (text.trim() === "") {
        setPendingSelection(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const startEl =
        range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : (range.startContainer as Element);
      const endEl =
        range.endContainer.nodeType === Node.TEXT_NODE
          ? range.endContainer.parentElement
          : (range.endContainer as Element);

      const startTarget = cursor.getTargetForElement(startEl);
      const endTarget = cursor.getTargetForElement(endEl);
      if (!startTarget || !endTarget) {
        setPendingSelection(null);
        return;
      }

      const startLine = Number(startTarget.getAttribute("data-line"));
      const endLine = Number(
        endTarget.getAttribute("data-line-end") ?? endTarget.getAttribute("data-line"),
      );
      const rect = range.getBoundingClientRect();

      setPendingSelection({ startLine, endLine, endTarget, text, rect });
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      cancelPendingClick();
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleGlobalKeydown);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [cursor, openEditor]);

  function handleQuoteClick() {
    if (!pendingSelection) return;
    const { startLine, endLine, text } = pendingSelection;
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    openEditor(startLine, endLine, text);
  }

  return (
    <>
      {Array.from(contentHosts.entries()).map(([key, host]) =>
        createPortal(
          <CommentSlot
            commentKey={key}
            comment={comments.get(key)}
            isEditing={editingKey === key}
            editingInitialText={editingInitialText}
            onSave={(text) => save(key, text)}
            onCancel={cancelEditing}
            onDelete={() => deleteComment(key)}
          />,
          host,
          key,
        ),
      )}
      <QuoteButton anchorRect={pendingSelection?.rect ?? null} onClick={handleQuoteClick} />
    </>
  );
}
