import { useRef } from "react";
import { CommentLayer } from "./components/CommentLayer.tsx";
import { LineNumberGutter } from "./components/LineNumberGutter.tsx";
import { MarkdownBody } from "./components/MarkdownBody.tsx";
import { OutdatedComments } from "./components/OutdatedComments.tsx";
import { TableOfContents } from "./components/TableOfContents.tsx";
import { TableTools } from "./components/TableTools.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { useComments } from "./hooks/useComments.ts";
import { CursorLineProvider } from "./hooks/useCursorLine.tsx";
import { useLiveReload } from "./hooks/useLiveReload.ts";
import { useMermaid } from "./hooks/useMermaid.ts";
import { useSettings } from "./hooks/useSettings.ts";
import { useTableTools } from "./hooks/useTableTools.ts";
import type { MdechoSettings } from "./lib/types.ts";

export function App({
  bodyHtml,
  source,
  filePath,
  relPath,
  entryRelPath,
  settings,
}: {
  bodyHtml: string;
  source: string;
  filePath: string;
  relPath: string;
  entryRelPath: string;
  settings: MdechoSettings;
}) {
  useLiveReload();
  const markdownBodyRef = useRef<HTMLElement | null>(null);
  const commentsApi = useComments(relPath, filePath, source);
  const tables = useTableTools(markdownBodyRef, bodyHtml);
  const settingsApi = useSettings(settings);
  // 図の色はmermaid側のテーマが持っているので、本文の配色に合わせて描き直す
  useMermaid(markdownBodyRef, bodyHtml, settingsApi.resolvedTheme);

  return (
    <CursorLineProvider markdownBodyRef={markdownBodyRef} relPath={relPath}>
      {/* 目次は fixed なので場所を取らない。その分の幅をここで空け、残った幅の中で
          本文を中央寄せして左右の余白を揃える(余白の取り方はstyles.css)。 */}
      <div className="mdecho-layout">
        <div className="mdecho-page mx-auto w-full max-w-[var(--mdecho-content-width)] p-8">
          <Toolbar
            relPath={relPath}
            filePath={filePath}
            entryRelPath={entryRelPath}
            commentGroups={commentsApi.commentGroups}
            otherFileCount={commentsApi.otherFileCount}
            deleteAllComments={commentsApi.deleteAllComments}
            openSettings={settingsApi.openDialog}
            themeMode={settingsApi.themeMode}
            setThemeMode={settingsApi.setThemeMode}
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
          <OutdatedComments
            comments={commentsApi.outdatedComments}
            clearOutdated={commentsApi.clearOutdatedComments}
          />
          <TableTools tables={tables} />
          <SettingsDialog settings={settingsApi} />
        </div>
      </div>
      <TableOfContents />
    </CursorLineProvider>
  );
}
