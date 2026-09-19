import { Plus } from "lucide-react";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { filterFonts } from "../lib/font-filter.ts";
import type { SystemFont } from "../lib/types.ts";

/** 候補リストの高さの上限(px)と、境界との余白。 */
const MAX_DROPDOWN_HEIGHT = 192;
const DROPDOWN_GAP = 8;
/** これより狭い側には開かない(1件も見えないため)。 */
const MIN_DROPDOWN_HEIGHT = 72;

interface DropdownPlacement {
  side: "bottom" | "top";
  maxHeight: number;
}

/**
 * フォント名の入力欄と候補リスト。
 *
 * <datalist>はChromeだとフォーカスの当たっていない入力への1回目のクリックでは候補が開かず、
 * 2回クリックする必要があるため、候補リストは自前で描画している。
 * 併せて別名(日本語名など)での絞り込みも自前のロジックで行える。
 */
export function FontCombobox({
  label,
  fonts,
  loading,
  selected,
  onAdd,
  boundaryRef,
}: {
  label: string;
  fonts: SystemFont[];
  loading: boolean;
  selected: string[];
  onAdd: (name: string) => void;
  /** 候補リストがはみ出さないよう収めたい要素(モーダルの本体) */
  boundaryRef: RefObject<HTMLElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);
  const [placement, setPlacement] = useState<DropdownPlacement>({
    side: "bottom",
    maxHeight: MAX_DROPDOWN_HEIGHT,
  });

  const candidates = useMemo(() => filterFonts(fonts, query, selected), [fonts, query, selected]);
  const active = candidates.fonts[activeIndex];

  // 候補が入れ替わったときに、選択位置が範囲外のまま残らないようにする。
  useEffect(() => {
    setActiveIndex((current) => (current < candidates.fonts.length ? current : 0));
  }, [candidates.fonts.length]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // 候補リストはレイアウトを押し広げないよう浮かせて表示する。そのぶんモーダルからは
  // はみ出しうるので、下に入らなければ上開きにし、高さも収まる分だけに抑える。
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const input = inputRef.current;
    const boundary = boundaryRef.current;
    if (!input || !boundary) {
      return;
    }
    const inputRect = input.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const below = boundaryRect.bottom - inputRect.bottom - DROPDOWN_GAP;
    const above = inputRect.top - boundaryRect.top - DROPDOWN_GAP;
    const side = below >= MAX_DROPDOWN_HEIGHT || below >= above ? "bottom" : "top";
    const available = side === "bottom" ? below : above;
    setPlacement({
      side,
      maxHeight: Math.max(MIN_DROPDOWN_HEIGHT, Math.min(MAX_DROPDOWN_HEIGHT, available)),
    });
  }, [open, boundaryRef, selected.length]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function add(name: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0 || selected.includes(trimmed)) {
      return;
    }
    onAdd(trimmed);
    setQuery("");
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const total = candidates.fonts.length;
      if (total === 0) {
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + delta + total) % total);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      add(open && active ? active.name : query);
      return;
    }
    if (event.key === "Escape" && open) {
      // モーダル自体が閉じてしまわないよう、候補を閉じるだけで止める
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="input input-sm input-bordered min-w-0 flex-1"
          placeholder="フォント名を入力または選択"
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-label={`${label}のフォント名`}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`${label}のフォントを追加`}
          disabled={query.trim().length === 0}
          onClick={() => add(query)}
        >
          <Plus className="size-[1.1em]" />
        </button>
      </div>

      {open && (
        <div
          className={`absolute z-10 w-full overflow-y-auto rounded border border-base-300 bg-base-100 shadow-lg ${
            placement.side === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          }`}
          style={{ maxHeight: placement.maxHeight }}
        >
          {loading && <p className="px-2 py-1.5 text-sm text-base-content/60">読み込み中...</p>}
          {!loading && candidates.fonts.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-base-content/60">
              候補がありません(入力した名前をそのまま追加できます)
            </p>
          )}
          <ul>
            {candidates.fonts.map((font, index) => (
              <li key={font.name} ref={index === activeIndex ? activeItemRef : undefined}>
                <button
                  type="button"
                  className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-sm ${
                    index === activeIndex ? "bg-base-300" : "hover:bg-base-200"
                  }`}
                  // inputのblurより先に選択を確定させたいのでmouseDownで拾う
                  onMouseDown={(event) => {
                    event.preventDefault();
                    add(font.name);
                  }}
                >
                  <span className="truncate">{font.name}</span>
                  {font.aliases.length > 0 && (
                    <span className="truncate text-xs text-base-content/50">
                      {font.aliases.join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {candidates.omitted > 0 && (
            <p className="px-2 py-1.5 text-xs text-base-content/50">
              ほか{candidates.omitted}件(絞り込んでください)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
