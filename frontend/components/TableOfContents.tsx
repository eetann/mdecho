import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { findCursorHeadingIndex, scrollTopToReveal } from "../lib/scroll-spy.ts";
import { buildToc, headingLevelOf } from "../lib/toc.ts";
import { useCursorIndex, useCursorLine } from "../hooks/useCursorLine.tsx";
import { useScrollSpy } from "../hooks/useScrollSpy.ts";

export function TableOfContents() {
  const { targets, getTargetByLine, setCursorToElement } = useCursorLine();
  const [collapsed, setCollapsed] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

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
  }, [activeIndex]);

  if (entries.length === 0) return null;

  function handleClick(line: number) {
    const target = getTargetByLine(line);
    if (!target) return;
    setCursorToElement(target);
  }

  return (
    <>
      <button
        type="button"
        className="mdecho-toc-toggle btn btn-xs btn-circle fixed top-16 right-8 z-30 hidden xl:flex"
        aria-label={collapsed ? "目次を表示" : "目次を折りたたむ"}
        onClick={() => setCollapsed((current) => !current)}
      >
        {collapsed ? "☰" : "×"}
      </button>
      <nav
        ref={navRef}
        className={`mdecho-toc fixed top-24 right-8 z-10 hidden max-h-[calc(100vh-8rem)] w-48 overflow-y-auto transition-opacity xl:block ${
          collapsed ? "pointer-events-none opacity-0" : ""
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
    </>
  );
}
