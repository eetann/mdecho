import { Fragment, useEffect, useRef } from "react";

interface Shortcut {
  /** 外側は「同じ操作の別の割り当て」、内側は「同時押し」 */
  keys: string[][];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: ShortcutSection[] = [
  {
    title: "カーソル移動",
    shortcuts: [
      { keys: [["j"], ["↓"]], description: "次の行へ移動" },
      { keys: [["k"], ["↑"]], description: "前の行へ移動" },
    ],
  },
  {
    title: "コメント",
    shortcuts: [
      { keys: [["Enter"]], description: "カーソル行にコメントを書く" },
      { keys: [["Ctrl / ⌘", "Enter"]], description: "書きかけのコメントを保存" },
      { keys: [["Esc"]], description: "コメントの編集をやめる" },
    ],
  },
  {
    title: "表の拡大表示",
    shortcuts: [
      { keys: [["j"], ["k"]], description: "表の中だけで行を移動(↑↓も同じ)" },
      { keys: [["Enter"]], description: "カーソル行にコメントを書く" },
      { keys: [["Esc"]], description: "拡大表示を閉じる" },
    ],
  },
  {
    title: "モーダル",
    shortcuts: [{ keys: [["Esc"]], description: "設定やヘルプを閉じる" }],
  },
];

function KeyCombos({ keys }: { keys: string[][] }) {
  return (
    <span className="flex flex-none items-center gap-1">
      {keys.map((combo, comboIndex) => (
        <Fragment key={combo.join("+")}>
          {comboIndex > 0 && <span className="text-xs text-base-content/40">/</span>}
          {combo.map((key, keyIndex) => (
            <Fragment key={key}>
              {keyIndex > 0 && <span className="text-xs text-base-content/40">+</span>}
              <kbd className="kbd kbd-sm">{key}</kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

export function KeyboardHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} className="mdecho-keyboard-help modal" onClose={onClose}>
      <div className="modal-box max-w-md">
        <h2 className="text-lg font-semibold">キーボード操作</h2>
        <p className="mt-1 text-xs text-base-content/60">
          入力欄にカーソルがあるときは、本文側の操作は効きません。
        </p>

        <div className="my-4 flex flex-col gap-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="font-semibold">{section.title}</h3>
              <dl className="mt-2 flex flex-col gap-1">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="grid grid-cols-[8.5rem_1fr] items-center gap-3 rounded bg-base-200 px-2 py-1"
                  >
                    <dt>
                      <KeyCombos keys={shortcut.keys} />
                    </dt>
                    <dd className="min-w-0 text-sm">{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
