import { ChevronDown, ChevronUp, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { FONT_VARIABLES, type FontKind } from "../../src/styles/font.ts";
import {
  clampContentWidth,
  clampFontSize,
  clampLineHeight,
  CONTENT_WIDTH_MAX,
  CONTENT_WIDTH_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
} from "../../src/styles/layout.ts";
import type { SettingsApi } from "../hooks/useSettings.ts";
import type { LayoutSettings, LineBreakSettings } from "../lib/types.ts";
import { FontCombobox } from "./FontCombobox.tsx";
import { THEME_MODE_LABELS, THEME_MODE_ORDER } from "./Toolbar.tsx";

interface LineBreakItem {
  key: keyof LineBreakSettings;
  label: string;
  description: string;
  /** この項目を上書きするCLIフラグ(無効化する側) */
  disableFlag: string;
}

const LINE_BREAK_ITEMS: LineBreakItem[] = [
  {
    key: "splitSentences",
    label: "句点(。)ごとに改行する",
    description: "1つの段落でも、句点で区切って1文ずつ表示します",
    disableFlag: "--no-split-sentences",
  },
  {
    key: "singleNewline",
    label: "単一改行をそのまま改行にする",
    description:
      "Enterキー1回の改行を<br>にします。切るとMarkdown本来の扱い(空白としてつながる)になります",
    disableFlag: "--no-single-newline",
  },
];

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

interface LayoutItem {
  key: keyof LayoutSettings;
  label: string;
  description: string;
  /** 数値入力の右に出す単位。aria-labelにも使う */
  unit: string;
  min: number;
  max: number;
  /** スライダーの刻み。これより細かく合わせたいときは隣の数値入力を使う */
  step: number;
  clamp: (value: number) => number;
}

const LAYOUT_ITEMS: LayoutItem[] = [
  {
    key: "contentWidth",
    label: "本文の幅",
    description:
      "行番号と左右の余白を含めた、本文の列全体の幅です。目次のぶんを空けた残りの幅に対して中央寄せします",
    unit: "px",
    min: CONTENT_WIDTH_MIN,
    max: CONTENT_WIDTH_MAX,
    step: 8,
    clamp: clampContentWidth,
  },
  {
    key: "fontSize",
    label: "文字サイズ",
    description:
      "本文と行番号の文字の大きさです。見出しやコードはこの大きさを基準にした比率で決まります",
    unit: "px",
    min: FONT_SIZE_MIN,
    max: FONT_SIZE_MAX,
    step: 1,
    clamp: clampFontSize,
  },
  {
    key: "lineHeight",
    label: "行の高さ",
    description: "文字サイズに対する、1行ぶんの高さの倍率です。日本語の本文は1.7〜2.0が目安です",
    unit: "倍",
    min: LINE_HEIGHT_MIN,
    max: LINE_HEIGHT_MAX,
    step: 0.05,
    clamp: clampLineHeight,
  },
];

function LayoutField({ item, settings }: { item: LayoutItem; settings: SettingsApi }) {
  const value = settings.layoutDraft[item.key];
  // 入力途中の「5」を最小値へ丸めてしまわないよう、数値入力の見た目だけ文字列で持つ。
  const [typed, setTyped] = useState(String(value));

  // スライダー側で動かしたときは数値入力も追従させる。入力中(同じ数値)は書き換えない。
  useEffect(() => {
    setTyped((current) => (Number(current) === value ? current : String(value)));
  }, [value]);

  function handleTyped(next: string) {
    setTyped(next);
    const parsed = Number(next);
    // 範囲に収まった時点だけプレビューへ渡す。桁の途中は確定(blur)まで待つ。
    if (Number.isFinite(parsed) && parsed >= item.min && parsed <= item.max) {
      settings.setLayout(item.key, item.clamp(parsed));
    }
  }

  function commitTyped() {
    const parsed = Number(typed);
    const next = Number.isFinite(parsed) && typed.trim() !== "" ? item.clamp(parsed) : value;
    setTyped(String(next));
    settings.setLayout(item.key, next);
  }

  return (
    <div>
      <span className="text-sm">{item.label}</span>
      <span className="block text-xs text-base-content/60">{item.description}</span>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="range"
          className="range range-sm min-w-0 flex-1"
          aria-label={item.label}
          min={item.min}
          max={item.max}
          step={item.step}
          value={value}
          onChange={(event) => settings.setLayout(item.key, Number(event.target.value))}
        />
        <input
          type="number"
          className="input input-sm w-24 shrink-0"
          aria-label={`${item.label}(${item.unit})`}
          min={item.min}
          max={item.max}
          step={item.step}
          value={typed}
          onChange={(event) => handleTyped(event.target.value)}
          onBlur={commitTyped}
        />
        <span className="shrink-0 text-xs text-base-content/60">{item.unit}</span>
      </div>
    </div>
  );
}

function LayoutSection({ settings }: { settings: SettingsApi }) {
  return (
    <section className="mdecho-layout-section">
      <h3 className="font-semibold">レイアウト</h3>
      <p className="mt-1 text-xs text-base-content/60">
        スライダーか数値入力を動かすと、すぐ背景の表示に反映されます。
      </p>
      <div className="mt-2 flex flex-col gap-3">
        {LAYOUT_ITEMS.map((item) => (
          <LayoutField key={item.key} item={item} settings={settings} />
        ))}
      </div>
    </section>
  );
}

function ThemeSection({ settings }: { settings: SettingsApi }) {
  return (
    <section className="mdecho-theme-section">
      <h3 className="font-semibold">配色</h3>
      <p className="mt-1 text-xs text-base-content/60">
        押すとすぐ反映し、そのまま設定ファイルへ保存します(下の「保存」を押す必要はありません)。
        ツールバーのアイコンからも切り替えられます。
      </p>
      <div className="join mt-2">
        {THEME_MODE_ORDER.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`btn join-item btn-sm ${settings.themeMode === mode ? "btn-primary" : ""}`}
            aria-pressed={settings.themeMode === mode}
            onClick={() => settings.setThemeMode(mode)}
          >
            {THEME_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      {settings.themeMode === "system" && (
        <p className="mt-1 text-xs text-base-content/60">
          いまOSは{settings.resolvedTheme === "dark" ? "ダーク" : "ライト"}です。
        </p>
      )}
      <p className="mt-2 text-xs text-base-content/60">
        色そのものは設定ファイルの <code>theme.light</code> / <code>theme.dark</code>{" "}
        で変えられます(<code>primary</code> や <code>base-100</code>{" "}
        などのdaisyUIの色の名前で指定)。
      </p>
    </section>
  );
}

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

function LineBreakList({ settings }: { settings: SettingsApi }) {
  return (
    <section className="mdecho-line-break-section">
      <h3 className="font-semibold">改行</h3>
      <p className="mt-1 text-xs text-base-content/60">
        フォントと違い保存後に反映されるため、保存すると自動で読み込み直します。
      </p>

      <ul className="mt-2 flex flex-col gap-3">
        {LINE_BREAK_ITEMS.map((item) => {
          const overridden = settings.lineBreakOverride[item.key];
          return (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-sm mt-0.5 shrink-0"
                  checked={settings.lineBreakDraft[item.key]}
                  onChange={(event) => settings.setLineBreak(item.key, event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="text-sm">{item.label}</span>
                  <span className="block text-xs text-base-content/60">{item.description}</span>
                  {/* CLIフラグの方が強いので、保存しても今の表示が変わらないことを先に伝える */}
                  {overridden !== undefined && (
                    <span className="block text-xs text-warning">
                      起動時に{" "}
                      {overridden ? item.disableFlag.replace("--no-", "--") : item.disableFlag}{" "}
                      が指定されているため、この表示では{overridden ? "有効" : "無効"}
                      のままです(保存した内容は次回起動から効きます)
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
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
      <h4 className="font-semibold">
        {label}
        <span className="ml-2 text-xs font-normal text-base-content/60">{description}</span>
      </h4>

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
        <h2 className="text-lg font-semibold">設定</h2>

        <div className="my-4 flex flex-col gap-6">
          <ThemeSection settings={settings} />

          <LineBreakList settings={settings} />

          <LayoutSection settings={settings} />

          <section>
            <h3 className="font-semibold">フォント</h3>
            <p className="mt-1 text-xs text-base-content/60">
              上にあるものから順に使われ、そのフォントが無ければ次のものが使われます。選ぶとすぐ背景の表示に反映されます。
            </p>
            <div className="mt-3 flex flex-col gap-5">
              {FONT_SECTIONS.map((section) => (
                <FontList
                  key={section.kind}
                  {...section}
                  fonts={settings.fontDraft[section.kind]}
                  setFonts={settings.setFonts}
                  settings={settings}
                  boundaryRef={boxRef}
                />
              ))}
            </div>
          </section>
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
