/* lib/storage.ts */
export type AchieveMood = "good" | "neutral" | "tough" | null;

export type AchieveItem = {
  id: string;
  text: string;
  done: boolean; // 互換のため残す（できたことリストでは常に true でOK）
  createdAt: string; // ISO
};

export type AchieveDay = {
  ymd: string; // YYYY-MM-DD (JST)
  items: AchieveItem[];
  mood: AchieveMood; // null = 未設定
  memo: string; // "" = 未設定
  updatedAt: string; // ISO
};

export type DayEntry = {
  ymd: string;
  day: AchieveDay;
};

const DAY_KEY_PREFIX = "achieve:day:";

/**
 * キャッシュの鮮度判定用（saveDay が通れば更新される）
 * ※もしTodayが直接 localStorage.setItem をしているなら、ここが更新されないので
 *   key統計で差分検知して走査します（完全ではないが「追加」は救える）
 */
const META_UPDATED_AT_KEY = "achieve:meta:lastUpdatedAt";

type Listener = () => void;

let daysCache: DayEntry[] | null = null;
let daysCacheStamp: string | null = null;

// Today が saveDay を通さずに key を増やしたケースなどを救うための軽量統計
let daysCacheKeyCount = 0;
let daysCacheMaxYmd = "";

const listeners = new Set<Listener>();

let storageListenerRefCount = 0;
let isStorageListenerAttached = false;

function nowIso(): string {
  return new Date().toISOString();
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  for (const l of listeners) l();
}

function attachStorageListener(): void {
  if (!isBrowser()) return;
  if (isStorageListenerAttached) return;

  window.addEventListener("storage", onStorageEvent);
  isStorageListenerAttached = true;
}

function detachStorageListener(): void {
  if (!isBrowser()) return;
  if (!isStorageListenerAttached) return;

  window.removeEventListener("storage", onStorageEvent);
  isStorageListenerAttached = false;
}

function onStorageEvent(e: StorageEvent): void {
  // 他タブ更新などで localStorage が変わったらキャッシュを捨てて通知
  const k = e.key ?? "";
  if (k === META_UPDATED_AT_KEY || k.startsWith(DAY_KEY_PREFIX)) {
    invalidateDaysCache();
    emitChange();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isYmdString(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asStringTrim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length ? v : null;
}

function asMood(value: unknown): AchieveMood {
  if (value === "good" || value === "neutral" || value === "tough") return value;
  return null;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function dayKey(ymd: string): string {
  return `${DAY_KEY_PREFIX}${ymd}`;
}

function normalizeItem(v: unknown): AchieveItem | null {
  if (!isRecord(v)) return null;

  const id = asStringTrim(v.id) ?? "";
  const text = asStringTrim(v.text) ?? "";
  if (!id || !text) return null;

  const done = typeof v.done === "boolean" ? v.done : true;
  const createdAt = asStringTrim(v.createdAt) ?? nowIso();

  return { id, text, done, createdAt };
}

function normalizeDay(ymd: string, parsed: unknown): AchieveDay {
  const empty: AchieveDay = {
    ymd,
    items: [],
    mood: null,
    memo: "",
    updatedAt: nowIso(),
  };

  if (!isRecord(parsed)) return empty;

  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
  const items = itemsRaw
    .map((x) => normalizeItem(x))
    .filter((x): x is AchieveItem => x !== null);

  return {
    ymd,
    items,
    mood: asMood(parsed.mood),
    memo: asString(parsed.memo, ""),
    updatedAt: asString(parsed.updatedAt, nowIso()),
  };
}

export function loadDay(ymd: string): AchieveDay {
  const empty: AchieveDay = {
    ymd,
    items: [],
    mood: null,
    memo: "",
    updatedAt: nowIso(),
  };

  if (!isBrowser()) return empty;

  const raw = window.localStorage.getItem(dayKey(ymd));
  if (!raw) return empty;

  return normalizeDay(ymd, safeJsonParse(raw));
}

export function invalidateDaysCache(): void {
  daysCache = null;
  daysCacheStamp = null;
  daysCacheKeyCount = 0;
  daysCacheMaxYmd = "";
}

function readStamp(storage: Storage): string {
  return storage.getItem(META_UPDATED_AT_KEY) ?? "";
}

function computeKeyStats(storage: Storage): { count: number; maxYmd: string } {
  let count = 0;
  let maxYmd = "";

  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k || !k.startsWith(DAY_KEY_PREFIX)) continue;

    const ymd = k.slice(DAY_KEY_PREFIX.length);
    if (!isYmdString(ymd)) continue;

    count += 1;
    if (ymd.localeCompare(maxYmd) > 0) maxYmd = ymd;
  }

  return { count, maxYmd };
}

export function scanDaysFromStorage(storage: Storage): DayEntry[] {
  const out: DayEntry[] = [];

  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k || !k.startsWith(DAY_KEY_PREFIX)) continue;

    const ymd = k.slice(DAY_KEY_PREFIX.length);
    if (!isYmdString(ymd)) continue;

    const raw = storage.getItem(k);
    if (!raw) continue;

    const day = normalizeDay(ymd, safeJsonParse(raw));
    out.push({ ymd, day });
  }

  out.sort((a, b) => b.ymd.localeCompare(a.ymd));

  // 走査結果から統計も更新
  daysCacheKeyCount = out.length;
  daysCacheMaxYmd = out[0]?.ymd ?? "";

  return out;
}

/**
 * モジュールスコープキャッシュ取得
 * - METAスタンプ一致ならキャッシュ
 * - Todayが saveDay を通さず key を追加した場合は、key統計の差分で再走査
 */
export function getDaysCached(storage?: Storage): DayEntry[] {
  if (!isBrowser()) return [];

  const st = storage ?? window.localStorage;
  const stamp = readStamp(st);

  if (Array.isArray(daysCache) && daysCacheStamp === stamp) {
    const stats = computeKeyStats(st);
    // key増減 or 最新ymdの変化（追加）を検知できたら再走査
    if (stats.count === daysCacheKeyCount && stats.maxYmd === daysCacheMaxYmd) {
      return daysCache;
    }
  }

  const scanned = scanDaysFromStorage(st);
  daysCache = scanned;
  daysCacheStamp = stamp;
  return scanned;
}

/**
 * 強制再走査（ボタン操作など用）
 */
export function refreshDaysCache(storage?: Storage): DayEntry[] {
  if (!isBrowser()) return [];
  const st = storage ?? window.localStorage;

  invalidateDaysCache();
  const next = getDaysCached(st);
  emitChange();
  return next;
}

/**
 * useSyncExternalStore 用購読
 */
export function subscribeDays(listener: Listener): () => void {
  listeners.add(listener);

  storageListenerRefCount += 1;
  if (storageListenerRefCount === 1) attachStorageListener();

  return () => {
    listeners.delete(listener);

    storageListenerRefCount = Math.max(0, storageListenerRefCount - 1);
    if (storageListenerRefCount === 0) detachStorageListener();
  };
}

export function saveDay(day: AchieveDay): void {
  if (!isBrowser()) return;

  const ymd = day.ymd;
  if (!isYmdString(ymd)) return;

  const payload: AchieveDay = {
    ymd,
    items: Array.isArray(day.items) ? day.items : [],
    mood: day.mood ?? null,
    memo: typeof day.memo === "string" ? day.memo : "",
    updatedAt: nowIso(),
  };

  // 先に保存 → スタンプ更新
  window.localStorage.setItem(dayKey(ymd), JSON.stringify(payload));
  window.localStorage.setItem(META_UPDATED_AT_KEY, nowIso());

  // キャッシュ無効化 → 通知
  invalidateDaysCache();
  emitChange();
}
