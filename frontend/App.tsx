import { useRef } from "react";
import { CommentLayer } from "./components/CommentLayer.tsx";
import { LineNumberGutter } from "./components/LineNumberGutter.tsx";
import { MarkdownBody } from "./components/MarkdownBody.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { useComments } from "./hooks/useComments.ts";
import { CursorLineProvider } from "./hooks/useCursorLine.tsx";
import { useLiveReload } from "./hooks/useLiveReload.ts";

export function App({ bodyHtml, filePath }: { bodyHtml: string; filePath: string }) {
  useLiveReload();
  const markdownBodyRef = useRef<HTMLElement | null>(null);
  const fileName = filePath.split("/").pop() ?? filePath;
  const commentsApi = useComments();

  return (
    <div className="mdecho-page mx-auto w-full max-w-3xl p-8">
      <CursorLineProvider markdownBodyRef={markdownBodyRef}>
        <Toolbar fileName={fileName} filePath={filePath} comments={commentsApi.comments} />
        <div className="mdecho-content mb-1 flex">
          <LineNumberGutter markdownBodyRef={markdownBodyRef} />
          <MarkdownBody ref={markdownBodyRef} html={bodyHtml} />
        </div>
        <CommentLayer
          comments={commentsApi.comments}
          editingKey={commentsApi.editingKey}
          editingInitialText={commentsApi.editingInitialText}
          openEditor={commentsApi.openEditor}
          cancelEditing={commentsApi.cancelEditing}
          save={commentsApi.save}
        />
      </CursorLineProvider>
    </div>
  );
}
