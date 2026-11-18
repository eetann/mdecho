import { useRef } from "react";
import { ChangeBanner } from "./components/ChangeBanner.tsx";
import { CodeCopyButtons } from "./components/CodeCopyButtons.tsx";
import { CommentLayer } from "./components/CommentLayer.tsx";
import { FileList } from "./components/FileList.tsx";
import { LineNumberGutter } from "./components/LineNumberGutter.tsx";
import { LinkChoiceDialog } from "./components/LinkChoiceDialog.tsx";
import { MarkdownBody } from "./components/MarkdownBody.tsx";
import { OutdatedComments } from "./components/OutdatedComments.tsx";
import { TableOfContents } from "./components/TableOfContents.tsx";
import { TableTools } from "./components/TableTools.tsx";
import { SettingsDialog } from "./components/SettingsDialog.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { useCodeBlocks } from "./hooks/useCodeBlocks.ts";
import { useComments } from "./hooks/useComments.ts";
import { CursorLineProvider } from "./hooks/useCursorLine.tsx";
import { useLiveReload } from "./hooks/useLiveReload.ts";
import { useMermaid } from "./hooks/useMermaid.ts";
import { useReadMode } from "./hooks/useReadMode.ts";
import { useSettings } from "./hooks/useSettings.ts";
import { useTableTools } from "./hooks/useTableTools.ts";
import type { ChangedLineRange, EntryFile, FileChange, MdechoSettings } from "./lib/types.ts";

export function App({
  bodyHtml,
  source,
  filePath,
  relPath,
  entries,
  settings,
  changedLines,
  change,
  cliReadMode,
}: {
  bodyHtml: string;
  source: string;
  filePath: string;
  relPath: string;
  entries: EntryFile[];
  settings: MdechoSettings;
  changedLines: ChangedLineRange[];
  /** 表示中のファイルの`--git`のbaseからの変わり方。`--git`でなければ無い */
  change: FileChange | undefined;
  /** `--read`で起動したか。まだ画面で切り替えていなければ、これで読み取りモードを始める */
  cliReadMode: boolean;
}) {
  useLiveReload();
  const markdownBodyRef = useRef<HTMLElement | null>(null);
  const commentsApi = useComments(relPath, filePath, source, entries);
  const tables = useTableTools(markdownBodyRef, bodyHtml);
  const codeBlocks = useCodeBlocks(markdownBodyRef, bodyHtml);
  const settingsApi = useSettings(settings);
  const { readMode, toggleReadMode } = useReadMode(cliReadMode);
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
            entries={entries}
            commentGroups={commentsApi.commentGroups}
            clipboardFormat={settingsApi.clipboardFormat}
            otherFileCount={commentsApi.otherFileCount}
            deleteAllComments={commentsApi.deleteAllComments}
            openSettings={settingsApi.openDialog}
            themeMode={settingsApi.themeMode}
            setThemeMode={settingsApi.setThemeMode}
            changedLines={changedLines}
            change={change}
            readMode={readMode}
            toggleReadMode={toggleReadMode}
          />
          {change && <ChangeBanner change={change} changedLines={changedLines} />}
          <div className="mdecho-content mb-1 flex">
            <LineNumberGutter
              markdownBodyRef={markdownBodyRef}
              openEditor={commentsApi.openEditor}
              comments={commentsApi.comments}
              editing={commentsApi.editing}
              activeKey={commentsApi.activeKey}
              changedLines={changedLines}
              readMode={readMode}
            />
            <MarkdownBody ref={markdownBodyRef} html={bodyHtml} />
          </div>
          <CommentLayer
            comments={commentsApi.comments}
            editing={commentsApi.editing}
            pendingQuote={commentsApi.pendingQuote}
            openEditor={commentsApi.openEditor}
            activateEditor={commentsApi.activateEditor}
            cancelEditing={commentsApi.cancelEditing}
            save={commentsApi.save}
            deleteComment={commentsApi.deleteComment}
            readMode={readMode}
          />
          <OutdatedComments
            comments={commentsApi.outdatedComments}
            clearOutdated={commentsApi.clearOutdatedComments}
          />
          <TableTools tables={tables} />
          <CodeCopyButtons codeBlocks={codeBlocks} />
          <SettingsDialog settings={settingsApi} />
          <LinkChoiceDialog markdownBodyRef={markdownBodyRef} />
        </div>
      </div>
      <FileList entries={entries} relPath={relPath} commentCounts={commentsApi.commentCounts} />
      <TableOfContents />
    </CursorLineProvider>
  );
}
