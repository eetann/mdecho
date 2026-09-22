import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCommentSlots } from "../hooks/useCommentSlots.ts";
import { useCursorLine } from "../hooks/useCursorLine.tsx";
import { parseKey } from "../lib/comment-keys.ts";
import { isModalOpen } from "../lib/modal.ts";
import type { Comment } from "../lib/types.ts";
import { CommentSlot } from "./CommentSlot.tsx";
import { QuoteButton } from "./QuoteButton.tsx";

const UI_SELECTORS = [
  ".mdecho-comment-editor",
  ".mdecho-toolbar",
  ".mdecho-reply-button",
  ".mdecho-line-number-gutter",
  ".mdecho-toc",
  ".mdecho-col-resizer",
];

interface PendingSelection {
  startLine: number;
  endLine: number;
  sentenceIndex: number;
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

function isUiTarget(el: Element | null): boolean {
  if (!el) return true;
  return UI_SELECTORS.some((selector) => el.closest(selector) !== null);
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
  openEditor: (
    startLine: number,
    endLine: number,
    sentenceIndex?: number,
    selectedText?: string,
  ) => void;
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

  const contentHosts = useCommentSlots(
    visibleKeys,
    cursor.getTargetByLineAndSentence,
    cursor.targets,
  );

  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const eventTarget = event.target as Element | null;

      const viewEl = eventTarget?.closest(".mdecho-comment-view");
      if (viewEl) {
        if (hasActiveTextSelection()) return;
        const slot = viewEl.closest("[data-mdecho-comment-slot]");
        const key = slot?.getAttribute("data-mdecho-comment-slot");
        if (!key) return;
        const { startLine, endLine, sentenceIndex } = parseKey(key);
        const target = cursor.getTargetByLineAndSentence(endLine, sentenceIndex);
        if (target) openEditor(startLine, endLine, sentenceIndex);
        return;
      }

      if (isUiTarget(eventTarget)) return;

      // 本文のシングルクリックではエディタを開かない(テキスト選択を邪魔しないため)。
      // カーソル位置だけ合わせて、Enterやダブルクリックでコメントを開始できるようにする。
      const target = cursor.getTargetForElement(eventTarget);
      if (target) cursor.setCursorToElement(target);
    }

    function handleDocumentDoubleClick(event: MouseEvent) {
      const eventTarget = event.target as Element | null;
      if (eventTarget?.closest(".mdecho-comment-view")) return;
      if (isUiTarget(eventTarget)) return;

      const target = cursor.getTargetForElement(eventTarget);
      if (!target) return;

      // ダブルクリックで選択された単語は、行全体へのコメントを開く前に解除する。
      window.getSelection()?.removeAllRanges();
      setPendingSelection(null);

      cursor.setCursorToElement(target);
      const line = Number(target.getAttribute("data-line"));
      const sentenceIndex = cursor.getSentenceIndex(target);
      openEditor(line, line, sentenceIndex);
    }

    function handleGlobalKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(document.activeElement)) return;
      if (isModalOpen()) return;
      if (event.key !== "Enter") return;
      const target = cursor.getCurrentTarget();
      if (target) {
        event.preventDefault();
        const line = Number(target.getAttribute("data-line"));
        const sentenceIndex = cursor.getSentenceIndex(target);
        openEditor(line, line, sentenceIndex);
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
      const sentenceIndex = cursor.getSentenceIndex(endTarget);
      const rect = range.getBoundingClientRect();

      setPendingSelection({ startLine, endLine, sentenceIndex, endTarget, text, rect });
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("dblclick", handleDocumentDoubleClick);
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("dblclick", handleDocumentDoubleClick);
      document.removeEventListener("keydown", handleGlobalKeydown);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [cursor, openEditor]);

  function handleQuoteClick() {
    if (!pendingSelection) return;
    const { startLine, endLine, sentenceIndex, text } = pendingSelection;
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    openEditor(startLine, endLine, sentenceIndex, text);
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
