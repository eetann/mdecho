import { type RefObject, useEffect, useRef, useState } from "react";
import {
  LINK_BASE_LABELS,
  LINK_CHOICES_ATTRIBUTE,
  type LinkChoice,
  parseLinkChoices,
} from "../../src/markdown/link-choices.ts";

/** `/docs/%E6%97%A5.md#x`を`docs/日.md#x`のように、読める形にする */
function toDisplayPath(url: string): string {
  const path = url.replace(/^\/+/, "");
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/**
 * 行き先が複数考えられるリンク(`link.base`がaskで、ファイル基準とルート基準の両方に
 * 実在したもの)をクリックしたときに、どちらを開くか選ばせる。
 *
 * 選択肢はサーバーが`LINK_CHOICES_ATTRIBUTE`に載せている。hrefには先頭の選択肢が
 * 入っているので、Ctrl+クリックや中クリックで新しいタブに開くときは横取りせずそちらへ行かせる。
 * <dialog>で開くため、開いている間は本文側のキーボード操作も止まる(lib/modal.ts)。
 */
export function LinkChoiceDialog({
  markdownBodyRef,
}: {
  markdownBodyRef: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<{ text: string; choices: LinkChoice[] }>();

  useEffect(() => {
    const body = markdownBodyRef.current;
    if (!body) return;
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest(`a[${LINK_CHOICES_ATTRIBUTE}]`);
      if (!anchor || !body.contains(anchor)) return;
      const choices = parseLinkChoices(anchor.getAttribute(LINK_CHOICES_ATTRIBUTE));
      if (!choices) return;
      event.preventDefault();
      setPending({ text: anchor.textContent?.trim() ?? "", choices });
    };
    body.addEventListener("click", handleClick);
    return () => body.removeEventListener("click", handleClick);
  }, [markdownBodyRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) {
      dialog.showModal();
    } else if (!pending && dialog.open) {
      dialog.close();
    }
  }, [pending]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={() => setPending(undefined)}>
      <div className="modal-box">
        <h2 className="font-semibold">どちらを開きますか？</h2>
        {pending?.text && (
          <p className="mt-1 truncate text-sm text-base-content/60">リンク: {pending.text}</p>
        )}
        <ul className="mt-4 flex flex-col gap-2">
          {pending?.choices.map((choice) => (
            <li key={choice.base}>
              <a
                href={choice.url}
                className="btn btn-block h-auto justify-start py-2 text-left font-normal"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {LINK_BASE_LABELS[choice.base]}
                  </span>
                  <span className="block break-all text-xs text-base-content/70">
                    {toDisplayPath(choice.url)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-base-content/60">
          毎回選ばずに済ませたいときは、設定の「リンクと画像のパス」で基準を固定できます。
        </p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={() => setPending(undefined)}>
            キャンセル
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
