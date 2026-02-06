/* lib/useTagSuggest.ts */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeAliasKey } from "@/lib/diary";
import { runIdle, type CancelFn } from "@/lib/client-scheduler";
import { useDaysData } from "@/lib/useDaysData";
import { useTagAliases } from "@/lib/useTagAliases";
import { getActiveTagToken, type ActiveTagToken } from "@/lib/tags/active-token";
import { buildTagSuggestions, type TagSuggestion } from "@/lib/tags/suggest";

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

function getAliasesSig(aliases: Record<string, string>): string {
  const keys = Object.keys(aliases);
  const len = keys.length;
  if (len === 0) return "0:..:..";

  let min = keys[0] ?? "";
  let max = keys[0] ?? "";
  for (const k of keys) {
    if (k < min) min = k;
    if (k > max) max = k;
  }
  return `${len}:${min}:${max}`;
}

export function useTagSuggest(args: UseTagSuggestArgs): UseTagSuggestResult {
  const { text, cursor, focused, suggestEnabled, textareaRef, setText, onAfterInsert } = args;

  const activeTag = useMemo(() => getActiveTagToken(text, cursor), [text, cursor]);
  const shouldShowSuggest = focused && suggestEnabled && activeTag !== null;

  // A: 候補UIが開いてる時だけ読む
  const { entries, isLoading: isDaysLoading, requestRefresh: requestDaysRefresh } = useDaysData({
    enabled: shouldShowSuggest,
    refreshOnMount: true,
    refreshOnFocus: true,
    refreshOnVisible: true,
    throttleMs: 500,
  });

  const {
    aliases: aliasesRaw,
    isLoading: isAliasesLoading,
    requestRefresh: requestAliasesRefresh,
  } = useTagAliases({
    enabled: shouldShowSuggest,
    refreshOnMount: true,
    refreshOnFocus: true,
    refreshOnVisible: true,
    throttleMs: 500,
  });

  const aliases = useMemo(() => aliasesRaw ?? {}, [aliasesRaw]);

  // autoSpace は useTagSuggest 内で保持（既存挙動維持）
  const TAG_SUGGEST_SPACE_KEY = "achieve:tag-suggest:space:v1";

  const [autoSpace, setAutoSpace] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(TAG_SUGGEST_SPACE_KEY);
    if (!raw) return true;
    if (raw === "1") return true;
    if (raw === "0") return false;
    return true;
  });

  const toggleAutoSpace = useCallback((next: boolean) => {
    setAutoSpace(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TAG_SUGGEST_SPACE_KEY, next ? "1" : "0");
  }, []);

  // heavy compute in idle
  const [allSuggestions, setAllSuggestions] = useState<TagSuggestion[]>([]);
  const [computedKey, setComputedKey] = useState<string>("");
  const suggestJobCancelRef = useRef<CancelFn | null>(null);

  const entriesSig = useMemo(() => {
    if (!entries) return "none";
    const top = entries[0]?.ymd ?? "";
    return `${entries.length}:${top}`;
  }, [entries]);

  const aliasesSig = useMemo(() => getAliasesSig(aliases), [aliases]);

  const wantKey = useMemo(() => `${entriesSig}:${aliasesSig}`, [entriesSig, aliasesSig]);

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
    if (isDaysLoading || isAliasesLoading) return true;
    if (!entries) return true;
    return computedKey !== wantKey;
  }, [shouldShowSuggest, isDaysLoading, isAliasesLoading, entries, computedKey, wantKey]);

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
    requestDaysRefresh({ force: true });
    requestAliasesRefresh({ force: true });
  }, [requestDaysRefresh, requestAliasesRefresh]);

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
