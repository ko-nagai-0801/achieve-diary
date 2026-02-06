/* lib/days-refresh.ts */
import { runIdle, type CancelFn } from "@/lib/client-scheduler";
import { loadDaysIfNeeded } from "@/lib/days-store";

export type DaysRefreshRequest = {
  force?: boolean;
  immediate?: boolean; // true: 同期で実行（クリックなど）
  throttleMs?: number; // デフォルト 500ms
};

let lastRequestedAt = 0;
let jobCancel: CancelFn | null = null;

export function requestDaysRefresh(req?: DaysRefreshRequest): void {
  if (typeof window === "undefined") return;

  const throttleMs = req?.throttleMs ?? 500;
  const force = req?.force ?? false;
  const immediate = req?.immediate ?? false;

  const now = Date.now();
  if (!force && now - lastRequestedAt < throttleMs) return;
  lastRequestedAt = now;

  if (jobCancel) return;

  if (immediate) {
    loadDaysIfNeeded({ force });
    return;
  }

  jobCancel = runIdle(() => {
    jobCancel = null;
    loadDaysIfNeeded({ force });
  });
}

export function cancelDaysRefresh(): void {
  if (jobCancel) jobCancel();
  jobCancel = null;
}
