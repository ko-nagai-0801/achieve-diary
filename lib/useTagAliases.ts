/* lib/useTagAliases.ts */
"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { TagAliases } from "@/lib/diary";
import {
  getTagAliasesSnapshot,
  readTagAliasesFromStorage,
  requestTagAliasesRefresh,
  refreshTagAliasesNow,
  subscribeTagAliases,
  type TagAliasesRefreshRequest,
} from "@/lib/aliases-store";

export type UseTagAliasesOptions = {
  enabled?: boolean;
  refreshOnMount?: boolean;
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;
  throttleMs?: number;
};

function noopUnsubscribe(): void {}

function subscribeNoop(): () => void {
  return noopUnsubscribe;
}

function getServerSnapshot(): TagAliases | null {
  return null;
}

function getClientSnapshot(): TagAliases | null {
  if (typeof window === "undefined") return null;

  // 既にロード済みならキャッシュを返す
  const cached = getTagAliasesSnapshot();
  if (cached) return cached;

  // 初回レンダーの “空” を避けるため、軽い読み取りでフォールバック（入口は aliases-store に統一）
  return readTagAliasesFromStorage(window.localStorage);
}

export function useTagAliases(opts?: UseTagAliasesOptions): {
  aliases: TagAliases;
  isLoading: boolean;
  requestRefresh: (req?: TagAliasesRefreshRequest) => void;
  refreshNow: () => void;
} {
  const enabled = opts?.enabled ?? true;
  const refreshOnMount = opts?.refreshOnMount ?? true;
  const refreshOnFocus = opts?.refreshOnFocus ?? true;
  const refreshOnVisible = opts?.refreshOnVisible ?? true;
  const throttleMs = opts?.throttleMs ?? 500;

  const snapshot = useSyncExternalStore(
    enabled ? subscribeTagAliases : subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  // 「ロード済みキャッシュがない」= ストア視点では未ロード
  const isLoading = useMemo(() => {
    if (!enabled) return false;
    if (typeof window === "undefined") return true;
    return getTagAliasesSnapshot() === null;
  }, [enabled]);

  const aliases = useMemo<TagAliases>(() => snapshot ?? {}, [snapshot]);

  const requestRefresh = useCallback(
    (req?: TagAliasesRefreshRequest) => {
      if (!enabled) return;
      requestTagAliasesRefresh({ throttleMs, ...req });
    },
    [enabled, throttleMs],
  );

  const refreshNow = useCallback(() => {
    if (!enabled) return;
    refreshTagAliasesNow();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (refreshOnMount) {
      // effect内同期setStateはしない：setTimeoutで “即時” 扱い
      requestRefresh({ immediate: true });
    }

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

  return { aliases, isLoading, requestRefresh, refreshNow };
}

export default useTagAliases;
