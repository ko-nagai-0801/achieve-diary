/* lib/days-store.ts
 * DayEntry をキャッシュして subscribe/snapshot を提供（useSyncExternalStore向け）
 * refresh/idle/間引き/二重予約防止は lib/days-refresh.ts に委譲
 */

import {
  DAY_KEY_PREFIX,
  META_UPDATED_AT_KEY,
  isYmdString,
  scanDaysFromStorage,
  subscribeStorageMutations,
  type DayEntry,
} from "@/lib/storage";

type Listener = () => void;

const listeners = new Set<Listener>();

const EMPTY_ENTRIES: DayEntry[] = [];

let loaded = false;
let cache: DayEntry[] = EMPTY_ENTRIES;

// 鮮度管理
let stamp = "";
let keyCount = 0;
let maxYmd = "";

// 何らかの変化があった（次回refreshで再評価したい）
let dirty = true;

// 外部イベント購読（参照カウント）
let refCount = 0;
let detachStorageMutation: (() => void) | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  for (const l of listeners) l();
}

function readStamp(storage: Storage): string {
  return storage.getItem(META_UPDATED_AT_KEY) ?? "";
}

function computeKeyStats(storage: Storage): { count: number; max: string } {
  let count = 0;
  let max = "";

  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k || !k.startsWith(DAY_KEY_PREFIX)) continue;

    const ymd = k.slice(DAY_KEY_PREFIX.length);
    if (!isYmdString(ymd)) continue;

    count += 1;
    if (ymd.localeCompare(max) > 0) max = ymd;
  }

  return { count, max };
}

function shouldRescan(storage: Storage): boolean {
  if (!loaded) return true;
  if (dirty) return true;

  const nextStamp = readStamp(storage);
  if (nextStamp !== stamp) return true;

  // Todayが saveDay を通さず META を更新しない場合などは key統計で救う
  const stats = computeKeyStats(storage);
  if (stats.count !== keyCount) return true;
  if (stats.max !== maxYmd) return true;

  return false;
}

function rescan(storage: Storage): void {
  const next = scanDaysFromStorage(storage);

  cache = next.length ? next : EMPTY_ENTRIES;
  loaded = true;

  stamp = readStamp(storage);
  const stats = computeKeyStats(storage);
  keyCount = stats.count;
  maxYmd = stats.max;

  dirty = false;
}

function onStorageEvent(e: StorageEvent): void {
  const k = e.key ?? "";
  if (k === META_UPDATED_AT_KEY || k.startsWith(DAY_KEY_PREFIX)) {
    dirty = true;
  }
}

function attachExternal(): void {
  if (!isBrowser()) return;

  window.addEventListener("storage", onStorageEvent);
  detachStorageMutation = subscribeStorageMutations(() => {
    // 同一タブ内の saveDay 通知
    dirty = true;
  });
}

function detachExternal(): void {
  if (!isBrowser()) return;

  window.removeEventListener("storage", onStorageEvent);
  if (detachStorageMutation) detachStorageMutation();
  detachStorageMutation = null;
}

/**
 * useSyncExternalStore 用：snapshot
 * - 初回は null（=未ロード）
 * - 1回ロードされたら配列（空配列でもOK）
 */
export function getDaysSnapshot(): DayEntry[] | null {
  if (!isBrowser()) return null;
  if (!loaded) return null;
  return cache;
}

export function subscribeDays(listener: Listener): () => void {
  listeners.add(listener);

  refCount += 1;
  if (refCount === 1) attachExternal();

  return () => {
    listeners.delete(listener);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) detachExternal();
  };
}

/**
 * 必要なら再走査して cache を更新し、更新があれば購読者に通知する
 * - days-refresh から呼ばれる想定
 */
export function loadDaysIfNeeded(opts?: { force?: boolean }): DayEntry[] {
  if (!isBrowser()) return EMPTY_ENTRIES;

  const storage = window.localStorage;
  const force = opts?.force ?? false;

  const need = force ? true : shouldRescan(storage);
  if (!need) return cache;

  const prev = cache;
  const prevLoaded = loaded;

  rescan(storage);

  // ロード状態 or 参照が変わったら通知
  if (!prevLoaded || prev !== cache) {
    emitChange();
  }

  return cache;
}

/**
 * “今すぐ” 強制走査（ボタンなど）
 */
export function refreshDaysNow(): DayEntry[] {
  return loadDaysIfNeeded({ force: true });
}
