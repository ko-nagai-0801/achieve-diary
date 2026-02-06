/* lib/useDaysData.ts */
"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getDaysSnapshot, refreshDaysNow, subscribeDays } from "@/lib/days-store";
import { requestDaysRefresh, type DaysRefreshRequest } from "@/lib/days-refresh";
import type { DayEntry } from "@/lib/storage";

export type UseDaysDataOptions = {
  enabled?: boolean;

  // B: mount/focus/visible で refresh を仕掛ける
  refreshOnMount?: boolean;
  refreshOnFocus?: boolean;
  refreshOnVisible?: boolean;

  // C: refresh の間引き
  throttleMs?: number;

  // 追加で “外部状態” を一緒に更新したい場合（例：タグ辞書をidleで再読込）
  onRefreshRequested?: () => void;
};

export type UseDaysDataResult = {
  entries: DayEntry[] | null; // null: 未ロード
  isLoading: boolean;

  // idleでrefresh（デフォルト）
  requestRefresh: (req?: DaysRefreshRequest) => void;

  // 同期refresh（クリックなど）
  refreshNow: () => void;
};

function getServerSnapshot(): DayEntry[] | null {
  return null;
}

export function useDaysData(opts?: UseDaysDataOptions): UseDaysDataResult {
  const enabled = opts?.enabled ?? true;

  const refreshOnMount = opts?.refreshOnMount ?? true;
  const refreshOnFocus = opts?.refreshOnFocus ?? true;
  const refreshOnVisible = opts?.refreshOnVisible ?? true;

  const throttleMs = opts?.throttleMs ?? 500;
  const onRefreshRequested = opts?.onRefreshRequested;

  const entries = useSyncExternalStore(subscribeDays, getDaysSnapshot, getServerSnapshot);

  const requestRefresh = useCallback(
    (req?: DaysRefreshRequest) => {
      if (!enabled) return;

      requestDaysRefresh({
        throttleMs: req?.throttleMs ?? throttleMs,
        force: req?.force,
        immediate: req?.immediate,
      });

      if (onRefreshRequested) onRefreshRequested();
    },
    [enabled, throttleMs, onRefreshRequested],
  );

  const refreshNow = useCallback(() => {
    if (!enabled) return;
    refreshDaysNow();
    if (onRefreshRequested) onRefreshRequested();
  }, [enabled, onRefreshRequested]);

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

  return { entries, isLoading: entries === null, requestRefresh, refreshNow };
}
