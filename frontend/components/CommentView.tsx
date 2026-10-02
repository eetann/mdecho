import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLineRef } from "../lib/line-ref.ts";

export function CommentView({
  startLine,
  endLine,
  text,
  originalText,
  outdated = false,
}: {
  startLine: number;
  endLine: number;
  text: string;
  /** outdatedのときに、コメントを付けた時点の原文として見せる */
  originalText?: string;
  /** 本文が書き換わって付け先を失ったコメント。クリックで編集できないので見た目も変える */
  outdated?: boolean;
}) {
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRenderedHtml(null);

    (async () => {
      try {
        const response = await fetch("/api/render-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { html: string };
        if (!cancelled) setRenderedHtml(data.html);
      } catch {
        // ネットワークエラー時などはプレーンテキスト表示のままにする
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div
      className={`mdecho-comment-view card card-border border-l-[3px] bg-base-200 p-3 ${
        outdated ? "border-l-base-content/30" : "cursor-pointer border-l-warning"
      }`}
    >
      <div className="mdecho-comment-line-ref flex items-center gap-2 font-mono text-xs text-base-content/60 after:flex-1 after:border-t after:border-dashed after:border-base-300 after:content-['']">
        {formatLineRef(startLine, endLine)}
        {outdated && <span className="badge badge-ghost badge-xs font-sans">Outdated</span>}
      </div>
      {originalText !== undefined && (
        <pre className="mdecho-comment-original-text my-2 overflow-x-auto border-l-2 border-base-300 pl-2 font-mono text-xs whitespace-pre-wrap text-base-content/60">
          {originalText}
        </pre>
      )}
      <div className="mdecho-comment-view-body-row flex items-start gap-2">
        <MessageSquare className="mdecho-comment-view-label mt-[0.2em] size-[1.1em] flex-none text-base-content/60" />
        {renderedHtml === null ? (
          <div className="mdecho-comment-view-body mdecho-comment-view-body-plain">{text}</div>
        ) : (
          <div
            className="mdecho-comment-view-body"
            // biome-ignore lint: サーバーの/api/render-commentが自前パイプラインでレンダリングしたHTML
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </div>
    </div>
  );
}
