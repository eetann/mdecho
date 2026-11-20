import { ChevronDown, ChevronUp } from "lucide-react";
import { useChangeNavigation } from "../hooks/useChangeNavigation.ts";
import type { ChangedMark } from "../lib/changed-marks.ts";

/** ツールバーに置く、前後の変更箇所へ飛ぶボタンと、いま何番目の変更にいるかの表示 */
export function ChangeNavigator({ marks }: { marks: readonly ChangedMark[] }) {
  const { position, canJump, jump } = useChangeNavigation(marks);
  const total = marks.length;
  return (
    <div className="mdecho-change-navigator flex flex-none items-center">
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-square"
        aria-label="previous change"
        title="前の変更へ (N)"
        disabled={!canJump.prev}
        onClick={() => jump(-1)}
      >
        <ChevronUp className="size-[1.1em]" />
      </button>
      <span
        className="mdecho-change-position min-w-[3.5em] text-center text-xs text-base-content/60 tabular-nums"
        title="変更箇所"
      >
        {position === 0 ? "–" : position} / {total}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-square"
        aria-label="next change"
        title="次の変更へ (n)"
        disabled={!canJump.next}
        onClick={() => jump(1)}
      >
        <ChevronDown className="size-[1.1em]" />
      </button>
    </div>
  );
}
