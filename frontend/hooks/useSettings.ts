import { useCallback, useEffect, useState } from "react";
import { buildFontFamilyValue, FONT_VARIABLES, type FontKind } from "../../src/font-css.ts";
import type { FontSettings, MdechoSettings, SystemFont } from "../lib/types.ts";

export interface SettingsApi {
  open: boolean;
  openDialog: () => void;
  cancel: () => void;
  /** 編集中のフォント設定。保存前でもページには即座に反映される */
  draft: FontSettings;
  setFonts: (kind: FontKind, fonts: string[]) => void;
  systemFonts: SystemFont[];
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

export function useSettings(initial: MdechoSettings): SettingsApi {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<FontSettings>(initial.font);
  const [draft, setDraft] = useState<FontSettings>(initial.font);
  const [systemFonts, setSystemFonts] = useState<SystemFont[]>([]);
  const [systemFontsError, setSystemFontsError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  // 保存しなくても見た目で選べるよう、編集中の値をそのままCSS変数へ流し込む。
  // サーバーが<head>に注入したスタイルより、この要素側の指定が優先される。
  useEffect(() => {
    const root = document.documentElement;
    for (const kind of ["body", "code"] as const) {
      const value = buildFontFamilyValue(draft[kind], kind);
      if (value.length > 0) {
        root.style.setProperty(FONT_VARIABLES[kind].variable, value);
      } else {
        root.style.removeProperty(FONT_VARIABLES[kind].variable);
      }
    }
  }, [draft]);

  const openDialog = useCallback(() => {
    setOpen(true);
    setSaveError(undefined);
  }, []);

  const cancel = useCallback(() => {
    setDraft(saved);
    setSaveError(undefined);
    setOpen(false);
  }, [saved]);

  const setFonts = useCallback((kind: FontKind, fonts: string[]) => {
    setDraft((current) => ({ ...current, [kind]: fonts }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ font: draft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `保存に失敗しました (HTTP ${res.status})`);
      }
      setSaved(draft);
      setOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [draft]);

  // フォント一覧の取得はOSのコマンド実行を伴うため、モーダルを開くまで遅らせる。
  useEffect(() => {
    if (!open || systemFonts.length > 0 || systemFontsError !== undefined) {
      return;
    }
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
      }
    })();
    return () => {
      aborted = true;
    };
  }, [open, systemFonts.length, systemFontsError]);

  return {
    open,
    openDialog,
    cancel,
    draft,
    setFonts,
    systemFonts,
    systemFontsError,
    saving,
    saveError,
    dirty: !isSameFonts(draft, saved),
    save,
    configFile: initial.configFile,
    editable: initial.editable,
  };
}
