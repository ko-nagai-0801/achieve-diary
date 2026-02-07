/* lib/aliases-store.ts
 * TagAliases をキャッシュして subscribe/snapshot を提供（useSyncExternalStore向け）
 * 同一タブ即反映は notifyTagAliasesMutated()（保存UIの直後に呼ぶ）
 */

import {
  loadTagAliases,
  resetTagAliases,
  saveTagAliases,
  type TagAliases,
} from "@/lib/diary";
import { runIdle, type CancelFn } from "@/lib/client-scheduler";
import {
  DAY_KEY_PREFIX,
  META_UPDATED_AT_KEY,
  subscribeStorageMutations,
} from "@/lib/storage";

type Listener = () => void;

export type TagAliasesRefreshRequest = {
  throttleMs?: number;
  force?: boolean;
  immediate?: boolean;
};

const listeners = new Set<Listener>();

let loaded = false;
let cache: TagAliases = {};
let dirty = true;

// B+C: idle + 間引き + 二重予約防止
let refreshGateMs = 0;
let scheduledCancel: CancelFn | null = null;

// 参照カウント
let refCount = 0;
let detachStorageMutation: (() => void) | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  for (const l of listeners) l();
}

function shallowEqual(a: TagAliases, b: TagAliases): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function markDirty(): void {
  dirty = true;
}

function shouldReload(force: boolean): boolean {
  if (force) return true;
  if (!loaded) return true;
  if (dirty) return true;
  return false;
}

function reloadNow(force: boolean): TagAliases {
  if (!isBrowser()) return {};

  if (!shouldReload(force)) return cache;

  const next = loadTagAliases(window.localStorage);
  const changed = !loaded || !shallowEqual(cache, next);

  loaded = true;
  dirty = false;

  if (changed) {
    cache = next;
    emitChange();
  }

  return cache;
}

function onStorageEvent(e: StorageEvent): void {
  const key = e.key ?? "";

  // day更新は days-store 側で扱うので無視（他タブの day 書き換えで alias まで更新したくない）
  if (key.startsWith(DAY_KEY_PREFIX)) return;
  if (key === META_UPDATED_AT_KEY) return;

  markDirty();
}

function attachExternal(): void {
  if (!isBrowser()) return;

  window.addEventListener("storage", onStorageEvent);

  // 同一タブ内の変更通知（実装側が通知していれば拾える）
  detachStorageMutation = subscribeStorageMutations(() => {
    markDirty();
  });
}

function detachExternal(): void {
  if (!isBrowser()) return;

  window.removeEventListener("storage", onStorageEvent);

  if (detachStorageMutation) detachStorageMutation();
  detachStorageMutation = null;
}

/**
 * ✅ useTagAliases 側の「初回レンダーの空回避」用フォールバック
 * （UIは diary.ts を直接触らず、入口を aliases-store に統一する）
 */
export function readTagAliasesFromStorage(storage: Storage): TagAliases {
  return loadTagAliases(storage);
}

export function getTagAliasesSnapshot(): TagAliases | null {
  if (!isBrowser()) return null;
  if (!loaded) return null;
  return cache;
}

export function subscribeTagAliases(listener: Listener): () => void {
  listeners.add(listener);

  refCount += 1;
  if (refCount === 1) attachExternal();

  return () => {
    listeners.delete(listener);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) detachExternal();
  };
}

export function refreshTagAliasesNow(): TagAliases {
  return reloadNow(true);
}

export function loadTagAliasesIfNeeded(opts?: { force?: boolean }): TagAliases {
  const force = opts?.force ?? false;
  return reloadNow(force);
}

export function requestTagAliasesRefresh(req?: TagAliasesRefreshRequest): void {
  if (!isBrowser()) return;

  const throttleMs = req?.throttleMs ?? 500;
  const force = req?.force ?? false;
  const immediate = req?.immediate ?? false;

  const now = Date.now();

  if (!force) {
    if (now - refreshGateMs < throttleMs) return;
    refreshGateMs = now;
  } else {
    refreshGateMs = now;
  }

  if (scheduledCancel) return;

  if (immediate) {
    window.setTimeout(() => {
      reloadNow(force);
    }, 0);
    return;
  }

  scheduledCancel = runIdle(() => {
    scheduledCancel = null;
    reloadNow(force);
  });
}

/**
 * alias編集UIなど、同一タブで localStorage を更新した直後に呼ぶと、
 * すべての購読先へ即反映できます。
 */
export function notifyTagAliasesMutated(): void {
  markDirty();
  requestTagAliasesRefresh({ force: true, immediate: true });
}

/**
 * ✅ 保存処理の呼び忘れ防止：保存＋notify を1関数にまとめる
 */
export function saveTagAliasesAndNotify(storage: Storage, aliases: TagAliases): void {
  saveTagAliases(storage, aliases);
  notifyTagAliasesMutated();
}

/**
 * ✅ リセットも同様に「保存＋notify」で統一
 */
export function resetTagAliasesAndNotify(storage: Storage): TagAliases {
  const next = resetTagAliases(storage);
  notifyTagAliasesMutated();
  return next;
}
