import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CodeBlockHandle } from "../hooks/useCodeBlocks.ts";

const COPIED_LABEL_DURATION_MS = 1500;

type CopyState = "idle" | "copied" | "failed";

function CodeCopyButton({ handle }: { handle: CodeBlockHandle }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(handle.getText());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopyState("idle"), COPIED_LABEL_DURATION_MS);
  }

  const Icon = copyState === "copied" ? Check : Copy;
  const label =
    copyState === "copied"
      ? "コピーしました"
      : copyState === "failed"
        ? "コピーに失敗しました"
        : "コードをコピー";

  return (
    <button
      type="button"
      className="mdecho-code-copy btn btn-square btn-xs btn-ghost text-base-content/60 hover:text-base-content"
      data-state={copyState}
      title={label}
      aria-label={label}
      onClick={handleClick}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

/** useCodeBlocksが用意した各コードブロックの外枠に、コピーボタンをportalでマウントする。 */
export function CodeCopyButtons({ codeBlocks }: { codeBlocks: CodeBlockHandle[] }) {
  return (
    <>
      {codeBlocks.map((block) =>
        createPortal(<CodeCopyButton handle={block} />, block.toolsHost, `copy-${block.id}`),
      )}
    </>
  );
}
