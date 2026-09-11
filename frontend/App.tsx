import { useRef } from "react";
import { CommentLayer } from "./components/CommentLayer.tsx";
import { LineNumberGutter } from "./components/LineNumberGutter.tsx";
import { MarkdownBody } from "./components/MarkdownBody.tsx";
import { TableOfContents } from "./components/TableOfContents.tsx";
import { TableTools } from "./components/TableTools.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { useComments } from "./hooks/useComments.ts";
import { CursorLineProvider } from "./hooks/useCursorLine.tsx";
import { useLiveReload } from "./hooks/useLiveReload.ts";
import { useTableTools } from "./hooks/useTableTools.ts";

export function App({ bodyHtml, filePath }: { bodyHtml: string; filePath: string }) {
  useLiveReload();
  const markdownBodyRef = useRef<HTMLElement | null>(null);
  const fileName = filePath.split("/").pop() ?? filePath;
  const commentsApi = useComments();
  const tables = useTableTools(markdownBodyRef, bodyHtml);

  return (
    <CursorLineProvider markdownBodyRef={markdownBodyRef}>
      <div className="mdecho-page w-full max-w-5xl p-8 mx-auto">
        <Toolbar
          fileName={fileName}
          filePath={filePath}
          comments={commentsApi.comments}
          deleteAllComments={commentsApi.deleteAllComments}
        />
        <div className="mdecho-content mb-1 flex">
          <LineNumberGutter
            markdownBodyRef={markdownBodyRef}
            openEditor={commentsApi.openEditor}
            comments={commentsApi.comments}
            editingKey={commentsApi.editingKey}
          />
          <MarkdownBody ref={markdownBodyRef} html={bodyHtml} />
        </div>
        <CommentLayer
          comments={commentsApi.comments}
          editingKey={commentsApi.editingKey}
          editingInitialText={commentsApi.editingInitialText}
          openEditor={commentsApi.openEditor}
          cancelEditing={commentsApi.cancelEditing}
          save={commentsApi.save}
          deleteComment={commentsApi.deleteComment}
        />
        <TableTools tables={tables} />
      </div>
      <TableOfContents />
    </CursorLineProvider>
  );
}
