import { ChevronDown, ChevronUp, X } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { FONT_VARIABLES, type FontKind } from "../../src/font-css.ts";
import type { SettingsApi } from "../hooks/useSettings.ts";
import { FontCombobox } from "./FontCombobox.tsx";

interface FontSection {
  kind: FontKind;
  label: string;
  description: string;
  /** モーダルが本文を隠してしまうため、選択中のフォントを中でも確かめられるようにする */
  sample: string;
}

const FONT_SECTIONS: FontSection[] = [
  {
    kind: "body",
    label: "本文",
    description: "コードブロック・インラインコード以外",
    sample: "あア亜 漢字とかなの見え方 Handgloves 0123",
  },
  {
    kind: "code",
    label: "コードブロック",
    description: "インラインコードも含む",
    sample: 'const greeting = "こんにちは"; // Il1 O0',
  },
];

function moveItem(fonts: string[], from: number, to: number): string[] {
  if (to < 0 || to >= fonts.length) {
    return fonts;
  }
  const next = [...fonts];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) {
    return fonts;
  }
  next.splice(to, 0, moved);
  return next;
}

function FontList({
  kind,
  label,
  description,
  sample,
  fonts,
  setFonts,
  settings,
  boundaryRef,
}: FontSection & {
  fonts: string[];
  setFonts: (kind: FontKind, fonts: string[]) => void;
  settings: SettingsApi;
  boundaryRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section className="mdecho-font-section">
      <h3 className="font-semibold">
        {label}
        <span className="ml-2 text-xs font-normal text-base-content/60">{description}</span>
      </h3>

      {fonts.length === 0 ? (
        <p className="py-2 text-sm text-base-content/60">未設定(mdechoの既定フォントを使います)</p>
      ) : (
        <ol className="my-2 flex flex-col gap-1">
          {fonts.map((font, index) => (
            <li key={font} className="flex items-center gap-2 rounded bg-base-200 px-2 py-1">
              <span className="w-5 text-right text-xs text-base-content/60">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm">{font}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                aria-label={`${font}を上へ`}
                disabled={index === 0}
                onClick={() => setFonts(kind, moveItem(fonts, index, index - 1))}
              >
                <ChevronUp className="size-[1.1em]" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                aria-label={`${font}を下へ`}
                disabled={index === fonts.length - 1}
                onClick={() => setFonts(kind, moveItem(fonts, index, index + 1))}
              >
                <ChevronDown className="size-[1.1em]" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                aria-label={`${font}を削除`}
                onClick={() => setFonts(kind, fonts.toSpliced(index, 1))}
              >
                <X className="size-[1.1em]" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* CSS変数はライブプレビューで書き換わるので、変数を参照するだけで追従する */}
      <div className="my-2 flex items-center gap-2">
        <span className="shrink-0 text-xs text-base-content/50">プレビュー</span>
        <p
          className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap border-l-2 border-base-300 pl-2 text-sm"
          style={{ fontFamily: `var(${FONT_VARIABLES[kind].variable})` }}
        >
          {sample}
        </p>
      </div>

      <FontCombobox
        label={label}
        fonts={settings.systemFonts}
        loading={settings.systemFontsLoading}
        selected={fonts}
        onAdd={(name) => setFonts(kind, [...fonts, name])}
        boundaryRef={boundaryRef}
      />
    </section>
  );
}

export function SettingsDialog({ settings }: { settings: SettingsApi }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (settings.open && !dialog.open) {
      dialog.showModal();
    } else if (!settings.open && dialog.open) {
      dialog.close();
    }
  }, [settings.open]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={settings.cancel}>
      <div ref={boxRef} className="modal-box max-h-[85vh] max-w-xl">
        <h2 className="text-lg font-semibold">フォント設定</h2>
        <p className="mt-1 text-xs text-base-content/60">
          上にあるものから順に使われ、そのフォントが無ければ次のものが使われます。選ぶとすぐ背景の表示に反映されます。
        </p>

        <div className="my-4 flex flex-col gap-5">
          {FONT_SECTIONS.map((section) => (
            <FontList
              key={section.kind}
              {...section}
              fonts={settings.draft[section.kind]}
              setFonts={settings.setFonts}
              settings={settings}
              boundaryRef={boxRef}
            />
          ))}
        </div>

        {settings.systemFontsError !== undefined && (
          <p className="text-sm text-error">
            フォント一覧を取得できませんでした: {settings.systemFontsError}
          </p>
        )}
        {!settings.editable && (
          <p className="text-sm text-error">
            {settings.configFile} はUIから保存できない形式のため、保存は無効です。
          </p>
        )}
        {settings.saveError !== undefined && (
          <p className="text-sm text-error">{settings.saveError}</p>
        )}

        <p className="mt-2 truncate text-xs text-base-content/60" title={settings.configFile}>
          保存先: {settings.configFile}
        </p>

        <div className="modal-action">
          <button type="button" className="btn" onClick={settings.cancel}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!settings.editable || settings.saving || !settings.dirty}
            onClick={() => void settings.save()}
          >
            {settings.saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
