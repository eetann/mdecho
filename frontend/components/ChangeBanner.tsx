import { FileCheck, FileDiff, FilePlus } from "lucide-react";
import { formatChangeSummary } from "../lib/change-label.ts";
import { useChangedMarks } from "../hooks/useChangeNavigation.ts";
import type { ChangedLineRange, FileChange } from "../lib/types.ts";

const ICONS = { added: FilePlus, modified: FileDiff, unchanged: FileCheck } as const;

const TONES = {
  added: "border-success/40 bg-success/10",
  modified: "border-warning/40 bg-warning/10",
  unchanged: "border-base-300 bg-base-200",
} as const;

/**
 * 表示中のファイルが`--git`のbaseからどう変わったかを、本文の頭に一行で示す。
 * ガターの印だけでは「まるごと新しいファイル」か「数行だけ変えたファイル」かが分かりにくいため。
 */
export function ChangeBanner({
  change,
  changedLines,
}: {
  change: FileChange;
  changedLines: readonly ChangedLineRange[];
}) {
  const changeCount = useChangedMarks(changedLines).length;
  const Icon = ICONS[change.status];
  return (
    <div
      className={`mdecho-change-banner mb-4 flex items-center gap-2 rounded-box border px-3 py-1.5 text-sm ${TONES[change.status]}`}
    >
      <Icon className="size-[1.1em] shrink-0 text-base-content/70" aria-hidden="true" />
      <span>{formatChangeSummary(change, changeCount)}</span>
    </div>
  );
}
