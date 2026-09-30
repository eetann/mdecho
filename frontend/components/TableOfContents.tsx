import { TableOfContents as TocIcon, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findCursorHeadingIndex, scrollTopToReveal } from "../lib/scroll-spy.ts";
import { buildToc, headingLevelOf } from "../lib/toc.ts";
import { useCursorIndex, useCursorLine } from "../hooks/useCursorLine.tsx";
import { useMediaQuery } from "../hooks/useMediaQuery.ts";
import { useScrollSpy } from "../hooks/useScrollSpy.ts";
import { TOOLBAR_SLOT_ID } from "./Toolbar.tsx";

// 本文の横に目次を並べる余裕がある幅。styles.cssで右側を空ける幅(xl)と揃える。
const WIDE_MEDIA_QUERY = "(min-width: 80rem)";

export function TableOfContents() {
  const { targets, getTargetByLine, setCursorToElement } = useCursorLine();
  // 広い画面では本文の横に常に出しておき、邪魔なときだけ畳む。狭い画面では本文と
  // 重なってしまうので、普段は隠してボタンで開いたときだけ本文の上に重ねる。
  // 開閉の状態を分けておくのは、画面幅を行き来したときにそれぞれの既定に戻すため。
  const isWide = useMediaQuery(WIDE_MEDIA_QUERY);
  const [collapsed, setCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const isShown = isWide ? !collapsed : overlayOpen;
  const isOverlay = !isWide && overlayOpen;
  const navRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  // ツールバーは目次より先に描画されるので、ここで探せば置き場所はもうある
  const [toolbarSlot, setToolbarSlot] = useState<Element | null>(null);
  useLayoutEffect(() => {
    setToolbarSlot(document.getElementById(TOOLBAR_SLOT_ID));
  }, []);

  // 見出しの要素そのものを先に絞ってからエントリに変換するので、headings[i]とentries[i]は
  // 同じ見出しを指す。スクロールスパイは位置の計測に要素側を、カーソルの判定はtargetsの
  // 中での並び(positions)を使う。
  const { headings, headingPositions } = useMemo(() => {
    const headings: Element[] = [];
    const headingPositions: number[] = [];
    targets.forEach((target, index) => {
      if (headingLevelOf(target.tagName) === null) return;
      headings.push(target);
      headingPositions.push(index);
    });
    return { headings, headingPositions };
  }, [targets]);

  const entries = useMemo(
    () =>
      buildToc(
        headings.map((heading) => ({
          tagName: heading.tagName,
          line: Number(heading.getAttribute("data-line")),
          text: heading.textContent?.trim() ?? "",
          id: heading.id,
        })),
      ),
    [headings],
  );

  // 「今見ている節」と「カーソルのいる節」は普段は一致するが、マウスでスクロールだけすると
  // 離れる。離れているあいだにカーソルを見失わないよう、別々の印として両方出す。
  const activeIndex = useScrollSpy(headings);
  const cursorIndex = useCursorIndex();
  const cursorHeadingIndex = findCursorHeadingIndex(headingPositions, cursorIndex);

  // 見出しが多いと目次自体がスクロールするため、今見ている節が枠の外へ出たら追いかける。
  // 目次の中だけを動かすのは、scrollIntoViewだと本文側のスクロールまで巻き込みうるため。
  useLayoutEffect(() => {
    const nav = navRef.current;
    const item = activeItemRef.current;
    if (!nav || !item) return;
    nav.scrollTop = scrollTopToReveal({
      itemTop: item.offsetTop,
      itemHeight: item.offsetHeight,
      scrollTop: nav.scrollTop,
      viewHeight: nav.clientHeight,
    });
    // 隠れているあいだは寸法が取れないので、開いたときにも追いかけ直す
  }, [activeIndex, isShown]);

  // 重ねて開いた目次は、Escか目次の外を押したら閉じる
  useEffect(() => {
    if (!isOverlay) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOverlayOpen(false);
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (navRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOverlayOpen(false);
    }
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOverlay]);

  if (entries.length === 0) return null;

  function handleClick(line: number) {
    const target = getTargetByLine(line);
    if (!target) return;
    setCursorToElement(target);
    // 狭い画面では目次が本文を覆っているので、飛んだ先が見えるよう閉じる
    setOverlayOpen(false);
  }

  const nav = (
    <nav
      ref={navRef}
      className={`mdecho-toc overflow-y-auto ${
        isWide
          ? `fixed top-24 right-8 z-10 max-h-[calc(100vh-8rem)] w-48 transition-opacity ${
              collapsed ? "pointer-events-none opacity-0" : ""
            }`
          : // ツールバーの目次ボタンの真下に、本文に重ねて開く
            `absolute top-full right-0 mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-4rem)] rounded-box border border-base-300 bg-base-100 p-3 shadow-lg ${
              overlayOpen ? "" : "hidden"
            }`
      }`}
      aria-label="目次"
    >
      {entries.map((entry, index) => {
        const isActive = index === activeIndex;
        const hasCursor = index === cursorHeadingIndex;
        return (
          // 見出しへのリンクにしておくと、スクロールとURLの書き換えをブラウザに任せられる。
          // 目次から開いた位置をそのまま共有でき、「戻る」で元の位置にも戻れる。
          <a
            key={entry.line}
            ref={isActive ? activeItemRef : null}
            href={entry.id === "" ? undefined : `#${encodeURIComponent(entry.id)}`}
            // 目次の中での現在地。ページ内の位置を指すのでpageではなくlocationを使う。
            aria-current={isActive ? "location" : undefined}
            // 今見ている節は左の罫線と太字、カーソルのいる節は本文のカーソル行と同じ
            // 薄い青の下地で示す。印の意味が本文側と揃うので、離れていても対応が分かる。
            className={`mdecho-toc-item block w-full cursor-pointer truncate border-l-2 py-0.5 text-left text-sm transition-colors ${
              isActive
                ? "border-primary font-semibold text-base-content"
                : "border-transparent text-base-content/70 hover:text-base-content"
            } ${hasCursor ? "mdecho-toc-item-cursor" : ""}`}
            // 左の罫線ぶんの余白(0.5rem)を全項目に共通で足したうえで、見出しの階層を字下げで示す。
            style={{ paddingLeft: `calc(0.5rem + ${(entry.level - 1) * 0.9}em)` }}
            onClick={() => handleClick(entry.line)}
          >
            {entry.text}
          </a>
        );
      })}
    </nav>
  );

  if (!isWide) {
    if (!toolbarSlot) return null;
    // 狭い画面では右上の空きがツールバーで埋まっているので、ボタンごとツールバーの中へ置く。
    // ツールバーはstickyなので、スクロールしてもボタンと開いた目次が一緒についてくる。
    return createPortal(
      <>
        <button
          ref={toggleRef}
          type="button"
          className="mdecho-toc-toggle btn btn-sm btn-ghost"
          aria-label={overlayOpen ? "目次を閉じる" : "目次を開く"}
          aria-expanded={overlayOpen}
          title="目次"
          onClick={() => setOverlayOpen((current) => !current)}
        >
          {overlayOpen ? <X className="size-[1.1em]" /> : <TocIcon className="size-[1.1em]" />}
        </button>
        {nav}
      </>,
      toolbarSlot,
    );
  }

  return (
    <>
      <button
        type="button"
        className="mdecho-toc-toggle btn btn-xs btn-circle fixed top-16 right-8 z-30"
        aria-label={collapsed ? "目次を表示" : "目次を折りたたむ"}
        onClick={() => setCollapsed((current) => !current)}
      >
        {collapsed ? "☰" : "×"}
      </button>
      {nav}
    </>
  );
}
