import { useLayoutEffect, useState } from "react";
import { findActiveHeadingIndex, isAtBottom } from "../lib/scroll-spy.ts";

/**
 * 「今読んでいる位置」とみなす境界を、画面の上端から何rem下に置くか。
 *
 * ページ内リンクで飛んだ見出しが止まる位置(--mdecho-scroll-margin-top = 4.5rem)の
 * すぐ下に置く。ここより上だと、目次から短い節へ飛んだときに次の見出しまで境界を越えて、
 * クリックした項目ではなくその次が選ばれる。1rem空けているのは端数で取りこぼさないため。
 *
 * 画面の中ほど(高さの3割など)まで下げると読み進めたときの追従は滑らかになるが、
 * 飛び先の節がこの高さに満たないと同じ取りこぼしが起きる。節の長さに左右されない
 * 上寄りを取り、見出しが本文の読み始めの位置に来たところで切り替える。
 */
const READING_LINE_REM = 5.5;

/** 画面上の境界の位置(px)。ブラウザの既定文字サイズが変わってもremとの関係を保つ */
function readingLine(): number {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(rootFontSize) ? rootFontSize : 16) * READING_LINE_REM;
}

/** headingsのうち今読んでいる見出しのindexを、スクロールに追従して返す */
export function useScrollSpy(headings: readonly Element[]): number {
  const [activeIndex, setActiveIndex] = useState(-1);

  // 本文が描画されたフレームでハイライトも確定させたいのでuseLayoutEffectを使う。
  // useEffectだと、読み込み直後に一度どこも光っていない目次が見える。
  useLayoutEffect(() => {
    if (headings.length === 0) {
      setActiveIndex(-1);
      return;
    }

    let frame = 0;

    function update() {
      frame = 0;
      const viewHeight = window.innerHeight;
      setActiveIndex(
        findActiveHeadingIndex({
          tops: headings.map((heading) => heading.getBoundingClientRect().top),
          threshold: readingLine(),
          atBottom: isAtBottom({
            scrollY: window.scrollY,
            viewHeight,
            scrollHeight: document.documentElement.scrollHeight,
          }),
        }),
      );
    }

    // getBoundingClientRectはレイアウトの再計算を起こすので、scrollイベントの発火回数
    // そのままではなく1フレームに1回へ間引く。
    function schedule() {
      if (frame !== 0) return;
      frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [headings]);

  return activeIndex;
}
