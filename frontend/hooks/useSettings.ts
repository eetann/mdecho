import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_FONT, DEFAULT_LAYOUT, DEFAULT_LINE_BREAK } from "../../src/config/defaults.ts";
import { buildFontFamilyValue, FONT_VARIABLES, type FontKind } from "../../src/styles/font.ts";
import {
  buildContentWidthValue,
  buildFontSizeValue,
  buildLineHeightValue,
  CONTENT_WIDTH_VARIABLE,
  FONT_SIZE_VARIABLE,
  LINE_HEIGHT_VARIABLE,
} from "../../src/styles/layout.ts";
import {
  DEFAULT_THEME_MODE,
  type ResolvedTheme,
  resolveThemeMode,
  THEME_ATTRIBUTE,
  type ThemeColors,
  type ThemeMode,
} from "../../src/styles/theme.ts";
import type {
  FontSettings,
  LayoutSettings,
  LineBreakSettings,
  MdechoSettings,
  SystemFont,
} from "../lib/types.ts";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function prefersDarkNow(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

export interface SettingsApi {
  open: boolean;
  openDialog: () => void;
  cancel: () => void;
  /** 編集中のフォント設定。保存前でもページには即座に反映される */
  fontDraft: FontSettings;
  setFonts: (kind: FontKind, fonts: string[]) => void;
  /** 編集中の改行設定。反映にはサーバーでの再レンダリングが要るため、保存時に読み込み直す */
  lineBreakDraft: LineBreakSettings;
  setLineBreak: (key: keyof LineBreakSettings, value: boolean) => void;
  /** CLIフラグで固定されている項目。保存はできるが、この起動中の表示は変わらない */
  lineBreakOverride: Partial<LineBreakSettings>;
  /** 編集中のレイアウト設定。保存前でもページには即座に反映される */
  layoutDraft: LayoutSettings;
  setLayout: (key: keyof LayoutSettings, value: number) => void;
  /**
   * 配色をライト/ダークに固定するか、OSに合わせるか。
   * フォントやレイアウトと違いドラフトを持たず、押した時点で反映して保存する。
   */
  themeMode: ThemeMode;
  /** systemを解決したあとの、いま実際に当たっている配色 */
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  systemFonts: SystemFont[];
  systemFontsLoading: boolean;
  systemFontsError: string | undefined;
  saving: boolean;
  saveError: string | undefined;
  dirty: boolean;
  /** 編集中の値と配色が、まとめてmdechoの既定値と同じか(「デフォルトに戻す」の出し入れに使う) */
  isDefault: boolean;
  /**
   * 改行・レイアウト・フォント・配色を既定値へ戻す。配色以外はドラフトを書き換えるだけなので、
   * 設定ファイルへ残すには保存が要る(キャンセルで押す前に戻せる)。
   */
  resetDefaults: () => void;
  save: () => Promise<void>;
  configFile: string;
  editable: boolean;
}

function isSameFonts(a: FontSettings, b: FontSettings): boolean {
  return (
    a.body.length === b.body.length &&
    a.code.length === b.code.length &&
    a.body.every((font, i) => font === b.body[i]) &&
    a.code.every((font, i) => font === b.code[i])
  );
}

function isSameLineBreak(a: LineBreakSettings, b: LineBreakSettings): boolean {
  return a.splitSentences === b.splitSentences && a.singleNewline === b.singleNewline;
}

function isSameLayout(a: LayoutSettings, b: LayoutSettings): boolean {
  return (
    a.contentWidth === b.contentWidth && a.fontSize === b.fontSize && a.lineHeight === b.lineHeight
  );
}

export function useSettings(initial: MdechoSettings): SettingsApi {
  const [open, setOpen] = useState(false);
  const [savedFonts, setSavedFonts] = useState<FontSettings>(initial.font);
  const [fontDraft, setFontDraft] = useState<FontSettings>(initial.font);
  const [savedLineBreak] = useState<LineBreakSettings>(initial.lineBreak);
  const [lineBreakDraft, setLineBreakDraft] = useState<LineBreakSettings>(initial.lineBreak);
  const [savedLayout, setSavedLayout] = useState<LayoutSettings>(initial.layout);
  const [layoutDraft, setLayoutDraft] = useState<LayoutSettings>(initial.layout);
  const [systemFonts, setSystemFonts] = useState<SystemFont[]>([]);
  const [systemFontsLoading, setSystemFontsLoading] = useState(true);
  const [systemFontsError, setSystemFontsError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initial.theme.mode);
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow);
  // 色の上書きはUIから編集しないが、保存のたびに送り返さないとサーバー側の設定から
  // 消えてしまうため、受け取ったものをそのまま持っておく。
  const themeColors = useRef<{ light: ThemeColors; dark: ThemeColors }>({
    light: initial.theme.light,
    dark: initial.theme.dark,
  });
  const resolvedTheme = resolveThemeMode(themeMode, prefersDark);

  // 保存しなくても見た目で選べるよう、編集中の値をそのままCSS変数へ流し込む。
  // サーバーが<head>に注入したスタイルより、この要素側の指定が優先される。
  useEffect(() => {
    const root = document.documentElement;
    for (const kind of ["body", "code"] as const) {
      const value = buildFontFamilyValue(fontDraft[kind], kind);
      if (value.length > 0) {
        root.style.setProperty(FONT_VARIABLES[kind].variable, value);
      } else {
        root.style.removeProperty(FONT_VARIABLES[kind].variable);
      }
    }
  }, [fontDraft]);

  // 幅や文字サイズもフォントと同じく、保存しなくてもスライダーを動かした結果を
  // その場で確かめられるようにする。
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      CONTENT_WIDTH_VARIABLE,
      buildContentWidthValue(layoutDraft.contentWidth),
    );
    root.style.setProperty(FONT_SIZE_VARIABLE, buildFontSizeValue(layoutDraft.fontSize));
    root.style.setProperty(LINE_HEIGHT_VARIABLE, buildLineHeightValue(layoutDraft.lineHeight));
  }, [layoutDraft]);

  // OS側の設定変更に追従する。mode === "system" のときだけ見た目が変わる。
  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  // <head>のブートスクリプトが初回の描画前に書いた値を、ここから先は引き継いで更新する。
  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
  }, [resolvedTheme]);

  const openDialog = useCallback(() => {
    setOpen(true);
    setSaveError(undefined);
  }, []);

  const cancel = useCallback(() => {
    setFontDraft(savedFonts);
    setLineBreakDraft(savedLineBreak);
    setLayoutDraft(savedLayout);
    setSaveError(undefined);
    setOpen(false);
  }, [savedFonts, savedLayout, savedLineBreak]);

  const setFonts = useCallback((kind: FontKind, fonts: string[]) => {
    setFontDraft((current) => ({ ...current, [kind]: fonts }));
  }, []);

  const setLineBreak = useCallback((key: keyof LineBreakSettings, value: boolean) => {
    setLineBreakDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const setLayout = useCallback((key: keyof LayoutSettings, value: number) => {
    setLayoutDraft((current) => ({ ...current, [key]: value }));
  }, []);

  /**
   * 設定ファイルへ書き戻す。サーバーは受け取った内容で設定をまるごと差し替えるため、
   * 1項目だけ変えたいときも、残りは保存済みの値をそのまま載せて送る。
   */
  const postConfig = useCallback(
    async (next: {
      font: FontSettings;
      lineBreak: LineBreakSettings;
      layout: LayoutSettings;
      themeMode: ThemeMode;
    }) => {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          font: next.font,
          lineBreak: next.lineBreak,
          layout: next.layout,
          // 色はUIから編集しないが、載せずに送るとサーバーが持っている設定から消えてしまう
          // (設定ファイルへは書き戻さないので、ファイル側のコメントや並びは壊れない)。
          theme: { mode: next.themeMode, ...themeColors.current },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `保存に失敗しました (HTTP ${res.status})`);
      }
    },
    [],
  );

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      // フォントやレイアウトと違い、押した瞬間に反映して保存まで済ませる。
      // 保存できなくてもこの起動中の見た目は変えたままにして、理由はモーダルのエラー欄で伝える。
      setThemeModeState(mode);
      if (!initial.editable) return;
      void (async () => {
        try {
          // 編集中のドラフトではなく保存済みの値を載せる。設定モーダルでフォントをいじっている
          // 最中にここが走っても、まだ保存していない内容を書き込んでしまわないようにする。
          await postConfig({
            font: savedFonts,
            lineBreak: savedLineBreak,
            layout: savedLayout,
            themeMode: mode,
          });
          setSaveError(undefined);
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : String(error));
        }
      })();
    },
    [initial.editable, postConfig, savedFonts, savedLayout, savedLineBreak],
  );

  const resetDefaults = useCallback(() => {
    setFontDraft(DEFAULT_FONT);
    setLineBreakDraft(DEFAULT_LINE_BREAK);
    setLayoutDraft(DEFAULT_LAYOUT);
    // 配色だけはドラフトを持たないため、ここでも押した時点で反映して保存まで済ませる。
    // 色の上書き(theme.light / theme.dark)はUIの管轄外なので触らない。
    setThemeMode(DEFAULT_THEME_MODE);
  }, [setThemeMode]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      await postConfig({
        font: fontDraft,
        lineBreak: lineBreakDraft,
        layout: layoutDraft,
        themeMode,
      });
      // 改行の扱いはサーバー側のHTML生成で決まるため、フォントと違って読み込み直さないと反映されない。
      if (!isSameLineBreak(lineBreakDraft, savedLineBreak)) {
        location.reload();
        return;
      }
      setSavedFonts(fontDraft);
      setSavedLayout(layoutDraft);
      setOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [fontDraft, layoutDraft, lineBreakDraft, postConfig, savedLineBreak, themeMode]);

  // モーダルを開いた時点から取りに行くと、候補が出るまでの一拍が操作の邪魔になるため、
  // 表示時に先に取っておく。サーバー側はプロセス内でキャッシュしている。
  useEffect(() => {
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch("/api/fonts");
        const body = (await res.json()) as { fonts?: SystemFont[]; message?: string };
        if (aborted) return;
        if (!res.ok || !body.fonts) {
          throw new Error(
            body.message ?? `フォント一覧を取得できませんでした (HTTP ${res.status})`,
          );
        }
        setSystemFonts(body.fonts);
      } catch (error) {
        if (!aborted) {
          setSystemFontsError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!aborted) {
          setSystemFontsLoading(false);
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  return {
    open,
    openDialog,
    cancel,
    fontDraft,
    setFonts,
    lineBreakDraft,
    setLineBreak,
    lineBreakOverride: initial.lineBreakOverride,
    layoutDraft,
    setLayout,
    themeMode,
    resolvedTheme,
    setThemeMode,
    systemFonts,
    systemFontsLoading,
    systemFontsError,
    saving,
    saveError,
    dirty:
      !isSameFonts(fontDraft, savedFonts) ||
      !isSameLineBreak(lineBreakDraft, savedLineBreak) ||
      !isSameLayout(layoutDraft, savedLayout),
    isDefault:
      isSameFonts(fontDraft, DEFAULT_FONT) &&
      isSameLineBreak(lineBreakDraft, DEFAULT_LINE_BREAK) &&
      isSameLayout(layoutDraft, DEFAULT_LAYOUT) &&
      themeMode === DEFAULT_THEME_MODE,
    resetDefaults,
    save,
    configFile: initial.configFile,
    editable: initial.editable,
  };
}
