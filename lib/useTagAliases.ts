/* lib/useTagAliases.ts */
"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getTagAliasesSnapshot,
  refreshTagAliasesNow,
  requestTagAliasesRefresh,
  subscribeTagAliases,
  type TagAliasesRefreshRequest,
} from "@/lib/aliases-store";
import type { TagAliases } from "@/lib/diary";

function getServerSnapshot(): TagAliases | null {
  return null;
}

export type UseTagAliasesOptions = {
  enabled?: boolean;
  refreshOnMount?: boolean;
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;
  throttleMs?: number;
};

export type UseTagAliasesResult = {
  aliases: TagAliases | null;
  isLoading: boolean;
  requestRefresh: (req?: TagAliasesRefreshRequest) => void;
  refreshNow: () => void;
};

export function useTagAliases(opts?: UseTagAliasesOptions): UseTagAliasesResult {
  const enabled = opts?.enabled ?? true;

  const refreshOnMount = opts?.refreshOnMount ?? true;
  const refreshOnFocus = opts?.refreshOnFocus ?? true;
  const refreshOnVisible = opts?.refreshOnVisible ?? true;

  const throttleMs = opts?.throttleMs ?? 500;

  const aliases = useSyncExternalStore(
    subscribeTagAliases,
    getTagAliasesSnapshot,
    getServerSnapshot,
  );

  const requestRefresh = useCallback(
    (req?: TagAliasesRefreshRequest) => {
      if (!enabled) return;

      requestTagAliasesRefresh({
        throttleMs: req?.throttleMs ?? throttleMs,
        force: req?.force,
        immediate: req?.immediate,
      });
    },
    [enabled, throttleMs],
  );

  const refreshNow = useCallback(() => {
    if (!enabled) return;
    refreshTagAliasesNow();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (refreshOnMount) requestRefresh();

    const onFocus = () => {
      if (!refreshOnFocus) return;
      requestRefresh();
    };

    const onVis = () => {
      if (!refreshOnVisible) return;
      if (document.visibilityState === "visible") requestRefresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, refreshOnMount, refreshOnFocus, refreshOnVisible, requestRefresh]);

  return { aliases, isLoading: aliases === null, requestRefresh, refreshNow };
}
