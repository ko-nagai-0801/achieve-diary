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

export const DAY_KEY_PREFIX = "achieve:day:";

/**
 * キャッシュ鮮度のキー（saveDay 経由で更新される）
 */
export const META_UPDATED_AT_KEY = "achieve:meta:lastUpdatedAt";

type StorageMutationListener = () => void;

const mutationListeners = new Set<StorageMutationListener>();

function emitStorageMutation(): void {
  for (const l of mutationListeners) l();
}

/**
 * saveDay() など “このタブ内での永続化” をフックしたい側（days-store等）のため
 */
export function subscribeStorageMutations(listener: StorageMutationListener): () => void {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}

function nowIso(): string {
  return new Date().toISOString();
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

export function isYmdString(v: string): boolean {
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

  window.localStorage.setItem(dayKey(ymd), JSON.stringify(payload));
  window.localStorage.setItem(META_UPDATED_AT_KEY, nowIso());

  // 同一タブ内の購読者（days-store）が即反応できるように通知
  emitStorageMutation();
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
  return out;
}
