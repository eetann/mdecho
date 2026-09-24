import { useLayoutEffect } from "react";
import { findRestoreIndex } from "../lib/cursor-restore.ts";
import { computeLineParts } from "../lib/line-group.ts";
import {
  findAnchorIndex,
  formatScrollAnchor,
  type ScrollAnchor,
  parseScrollAnchor,
} from "../lib/scroll-anchor.ts";

// ファイルをまたいで読み進められるため、スクロール位置も表示中のファイルごとに分けて持つ。
const STORAGE_KEY_PREFIX = "mdecho:scroll:";

/**
 * 画面に見えている先頭とみなす基準線を、画面の上端から何rem下に置くか。
 *
 * sticky配置のツールバー(高さ4rem)の下端に合わせる(--mdecho-scroll-margin-topと同じ値)。
 * 画面の上端そのものを基準にしても復元後の見え方は変わらないが、基準になる要素が
 * ツールバーの裏に隠れたものになる。その行がファイルの書き換えで消えたときの寄せ先が、
 * 読んでいた場所から一段ズレてしまう。
 */
const ANCHOR_LINE_REM = 4.5;

/** 画面上の基準線の位置(px)。ブラウザの既定文字サイズが変わってもremとの関係を保つ */
function anchorLine(): number {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(rootFontSize) ? rootFontSize : 16) * ANCHOR_LINE_REM;
}

/**
 * 読んでいた位置をsessionStorageに覚えておき、リロード後にそこへ戻す。
 *
 * カーソル(useCursorLine)の復元だけではマウスで読んでいる間の移動を拾えない。
 * カーソルはj/kを押したときにしか動かないため、スクロールしただけのタブはリロードで
 * 先頭に戻ってしまう。スクロールそのものを見て、別に覚えておく。
 */
export function useScrollRestore(relPath: string, targets: readonly Element[]): void {
  useLayoutEffect(() => {
    if (targets.length === 0) return;

    const key = `${STORAGE_KEY_PREFIX}${relPath}`;
    const lines = targets.map((el) => Number(el.getAttribute("data-line")));
    const parts = computeLineParts(lines);
    let frame = 0;

    function save() {
      frame = 0;
      const threshold = anchorLine();
      const tops = targets.map((el) => el.getBoundingClientRect().top);
      const index = findAnchorIndex(tops, threshold);
      const line = lines[index];
      const top = tops[index];
      if (line === undefined || top === undefined) return;
      try {
        sessionStorage.setItem(
          key,
          formatScrollAnchor({ line, part: parts[index] ?? 0, offset: top - threshold }),
        );
      } catch {
        // sessionStorageが使えない環境(プライベートブラウジング等)は無視
      }
    }

    function restore() {
      let stored: ScrollAnchor | null = null;
      try {
        stored = parseScrollAnchor(sessionStorage.getItem(key));
      } catch {
        // sessionStorageが使えない環境(プライベートブラウジング等)は無視
      }
      if (stored === null) return;
      // 覚えていた行が書き換えで消えていれば、その次の行が返る。
      const el = targets[findRestoreIndex(lines, parts, stored)];
      if (!el) return;
      // カーソルの復元(useCursorLine)がすでに動かしている分があるため、絶対位置ではなく
      // 今の位置からの差で寄せる。
      window.scrollBy(0, el.getBoundingClientRect().top - anchorLine() - stored.offset);
    }

    // getBoundingClientRectはレイアウトの再計算を起こすので、scrollイベントの発火回数
    // そのままではなく1フレームに1回へ間引く。
    function schedule() {
      if (frame !== 0) return;
      frame = requestAnimationFrame(save);
    }

    // `#見出し`付きのURLで開いたときは、リンクが指す場所の方を優先する。
    if (location.hash === "") restore();

    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
    };
  }, [relPath, targets]);
}
