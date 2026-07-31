import { useState } from "react";
import { buildToc } from "../lib/toc.ts";
import { useCursorLine } from "../hooks/useCursorLine.tsx";

export function TableOfContents() {
  const { targets, getTargetByLine, setCursorToElement } = useCursorLine();
  const [collapsed, setCollapsed] = useState(false);

  const entries = buildToc(
    targets.map((target) => ({
      tagName: target.tagName,
      line: Number(target.getAttribute("data-line")),
      text: target.textContent?.trim() ?? "",
    })),
  );

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
        className={`mdecho-toc fixed top-24 right-8 z-10 hidden max-h-[calc(100vh-8rem)] w-48 overflow-y-auto transition-opacity xl:block ${
          collapsed ? "pointer-events-none opacity-0" : ""
        }`}
        aria-label="目次"
      >
        {entries.map((entry) => (
          <button
            key={entry.line}
            type="button"
            className="mdecho-toc-item block w-full cursor-pointer truncate py-0.5 text-left text-sm text-base-content/70 hover:text-base-content"
            style={{ paddingLeft: `${(entry.level - 1) * 0.9}em` }}
            onClick={() => handleClick(entry.line)}
          >
            {entry.text}
          </button>
        ))}
      </nav>
    </>
  );
}
