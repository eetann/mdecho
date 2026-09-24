import { useCallback, useEffect, useState } from "react";
import { buildFontFamilyValue, FONT_VARIABLES, type FontKind } from "../../src/font-css.ts";
import {
  buildContentWidthValue,
  buildFontSizeValue,
  buildLineHeightValue,
  CONTENT_WIDTH_VARIABLE,
  FONT_SIZE_VARIABLE,
  LINE_HEIGHT_VARIABLE,
} from "../../src/layout-css.ts";
import type {
  FontSettings,
  LayoutSettings,
  LineBreakSettings,
  MdechoSettings,
  SystemFont,
} from "../lib/types.ts";

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
  systemFonts: SystemFont[];
  systemFontsLoading: boolean;
  systemFontsError: string | undefined;
  saving: boolean;
  saveError: string | undefined;
  dirty: boolean;
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

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ font: fontDraft, lineBreak: lineBreakDraft, layout: layoutDraft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `保存に失敗しました (HTTP ${res.status})`);
      }
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
  }, [fontDraft, layoutDraft, lineBreakDraft, savedLineBreak]);

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
    systemFonts,
    systemFontsLoading,
    systemFontsError,
    saving,
    saveError,
    dirty:
      !isSameFonts(fontDraft, savedFonts) ||
      !isSameLineBreak(lineBreakDraft, savedLineBreak) ||
      !isSameLayout(layoutDraft, savedLayout),
    save,
    configFile: initial.configFile,
    editable: initial.editable,
  };
}
