import { useCallback, useEffect, useState } from "react";
import { isDialogOpen } from "../lib/modal.ts";
import { loadReadMode, resolveInitialReadMode, saveReadMode } from "../lib/read-mode-store.ts";
import { isEditableTarget } from "./useCursorLine.tsx";

export interface ReadModeApi {
  readMode: boolean;
  toggleReadMode: () => void;
}

/**
 * 読み取りモード。オンの間はコメントを書き始める操作(ダブルクリック・Enter・引用ボタン・
 * ガターの吹き出し)を止め、ダブルクリックで単語を選んでコピーできるようにする。
 * `r`キーでも切り替えられる。
 */
export function useReadMode(cliReadMode: boolean): ReadModeApi {
  const [readMode, setReadMode] = useState(() =>
    resolveInitialReadMode(loadReadMode(), cliReadMode),
  );

  const toggleReadMode = useCallback(() => {
    setReadMode((current) => {
      const next = !current;
      saveReadMode(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(document.activeElement)) return;
      if (isDialogOpen()) return;
      if (event.key !== "r") return;
      event.preventDefault();
      toggleReadMode();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [toggleReadMode]);

  return { readMode, toggleReadMode };
}
