/* lib/useTagSuggest.ts */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadTagAliases, normalizeAliasKey, type TagAliases } from "@/lib/diary";
import { runIdle, type CancelFn } from "@/lib/client-scheduler";
import { useDaysData } from "@/lib/useDaysData";
import { loadBool, saveBool } from "@/lib/prefs/bool";
import { getActiveTagToken, type ActiveTagToken } from "@/lib/tags/active-token";
import { buildTagSuggestions, type TagSuggestion } from "@/lib/tags/suggest";

const TAG_SUGGEST_SPACE_KEY = "achieve:tag-suggest:space:v1";

type UseTagSuggestArgs = {
  text: string;
  cursor: number;
  focused: boolean;
  suggestEnabled: boolean;

  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  setText: (next: string) => void;

  onAfterInsert?: () => void;
};

type UseTagSuggestResult = {
  activeTag: ActiveTagToken | null;
  shouldShowSuggest: boolean;

  autoSpace: boolean;
  toggleAutoSpace: (next: boolean) => void;

  isComputing: boolean;
  suggestions: TagSuggestion[]; // filtered(<=10)
  insertTag: (tag: string) => void;

  refresh: () => void;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function useTagSuggest(args: UseTagSuggestArgs): UseTagSuggestResult {
  const { text, cursor, focused, suggestEnabled, textareaRef, setText, onAfterInsert } = args;

  const activeTag = useMemo(() => getActiveTagToken(text, cursor), [text, cursor]);
  const shouldShowSuggest = focused && suggestEnabled && activeTag !== null;

  // days は「候補UIが開いてる時だけ」読み込む（A）
  const { entries, isLoading, requestRefresh } = useDaysData({
    enabled: shouldShowSuggest,
    refreshOnMount: true,
    refreshOnFocus: true,
    refreshOnVisible: true,
    throttleMs: 500,
  });

  // aliases も必要時だけ取り扱う（A）
  const [aliases, setAliases] = useState<TagAliases>(() => {
    if (!canUseStorage()) return {};
    return loadTagAliases(window.localStorage);
  });

  const [aliasesVersion, setAliasesVersion] = useState<number>(0);
  const aliasesJobCancelRef = useRef<CancelFn | null>(null);

  const requestAliasesRefresh = useCallback(() => {
    if (!canUseStorage()) return;
    if (aliasesJobCancelRef.current) return;

    aliasesJobCancelRef.current = runIdle(() => {
      aliasesJobCancelRef.current = null;
      setAliases(loadTagAliases(window.localStorage));
      setAliasesVersion((v) => v + 1);
    });
  }, []);

  // shouldShowSuggest が true になったタイミングで、idleで aliases を再読込（B）
  useEffect(() => {
    if (!shouldShowSuggest) return;

    requestAliasesRefresh();

    return () => {
      if (aliasesJobCancelRef.current) aliasesJobCancelRef.current();
      aliasesJobCancelRef.current = null;
    };
  }, [shouldShowSuggest, requestAliasesRefresh]);

  // autoSpace preference
  const [autoSpace, setAutoSpace] = useState<boolean>(() => {
    if (!canUseStorage()) return true;
    return loadBool(window.localStorage, TAG_SUGGEST_SPACE_KEY, true);
  });

  const toggleAutoSpace = useCallback((next: boolean) => {
    setAutoSpace(next);
    if (!canUseStorage()) return;
    saveBool(window.localStorage, TAG_SUGGEST_SPACE_KEY, next);
  }, []);

  // heavy suggestion compute (B) with key tracking (no setState in effect body)
  const [allSuggestions, setAllSuggestions] = useState<TagSuggestion[]>([]);
  const [computedKey, setComputedKey] = useState<string>("");
  const suggestJobCancelRef = useRef<CancelFn | null>(null);

  const entriesSig = useMemo(() => {
    if (!entries) return "none";
    const top = entries[0]?.ymd ?? "";
    return `${entries.length}:${top}`;
  }, [entries]);

  const wantKey = useMemo(() => {
    // shouldShowSuggest の時だけ意味があるキー
    return `${entriesSig}:${aliasesVersion}`;
  }, [entriesSig, aliasesVersion]);

  useEffect(() => {
    if (!shouldShowSuggest) return;
    if (!entries) return;

    if (suggestJobCancelRef.current) suggestJobCancelRef.current();
    suggestJobCancelRef.current = runIdle(() => {
      suggestJobCancelRef.current = null;
      const built = buildTagSuggestions(entries, aliases);
      setAllSuggestions(built);
      setComputedKey(wantKey);
    });

    return () => {
      if (suggestJobCancelRef.current) suggestJobCancelRef.current();
      suggestJobCancelRef.current = null;
    };
  }, [shouldShowSuggest, entries, aliases, wantKey]);

  const isComputing = useMemo(() => {
    if (!shouldShowSuggest) return false;
    if (isLoading) return true;
    if (!entries) return true;
    return computedKey !== wantKey;
  }, [shouldShowSuggest, isLoading, entries, computedKey, wantKey]);

  const suggestions = useMemo(() => {
    if (!shouldShowSuggest) return [];

    const tokenNorm = normalizeAliasKey(activeTag?.token ?? "");
    if (!tokenNorm) return allSuggestions.slice(0, 10);

    return allSuggestions
      .filter((s) => s.matchKeys.some((k) => k.includes(tokenNorm)))
      .slice(0, 10);
  }, [shouldShowSuggest, activeTag, allSuggestions]);

  const insertTag = useCallback(
    (tag: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const active = activeTag;
      if (!active) return;

      const { hashIndex } = active;

      let end = cursor;
      while (end < text.length && !/\s/.test(text[end] ?? "")) end++;

      const before = text.slice(0, hashIndex);
      const after = text.slice(end);

      let inserted = `#${tag}`;
      if (autoSpace) {
        const nextChar = after[0] ?? "";
        const needSpace = after.length === 0 || (nextChar !== "" && !/\s/.test(nextChar));
        if (needSpace) inserted += " ";
      }

      const nextText = `${before}${inserted}${after}`;
      const nextCursor = (before + inserted).length;

      setText(nextText);
      if (onAfterInsert) onAfterInsert();

      window.setTimeout(() => {
        const el2 = textareaRef.current;
        if (!el2) return;
        el2.focus();
        el2.setSelectionRange(nextCursor, nextCursor);
      }, 0);
    },
    [textareaRef, activeTag, cursor, text, autoSpace, setText, onAfterInsert],
  );

  const refresh = useCallback(() => {
    requestRefresh({ force: true });
    requestAliasesRefresh();

    // 計算結果は次の idle 計算で更新される
  }, [requestRefresh, requestAliasesRefresh]);

  return {
    activeTag,
    shouldShowSuggest,
    autoSpace,
    toggleAutoSpace,
    isComputing,
    suggestions,
    insertTag,
    refresh,
  };
}
