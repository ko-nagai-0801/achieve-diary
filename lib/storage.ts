/* lib/storage.ts */
export type AchieveItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string; // ISO string
};

export type AchieveDay = {
  version: 1;
  ymd: string; // YYYY-MM-DD (JST)
  items: AchieveItem[];
};

const KEY_PREFIX = "achieve-diary:v1:day:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAchieveItem(value: unknown): value is AchieveItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.done === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isAchieveDay(value: unknown): value is AchieveDay {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.ymd !== "string") return false;

  const items = value.items;
  if (!Array.isArray(items)) return false;
  if (!items.every(isAchieveItem)) return false;

  return true;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function hasLocalStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function makeEmptyDay(ymd: string): AchieveDay {
  return { version: 1, ymd, items: [] };
}

export function loadDay(ymd: string): AchieveDay {
  if (!hasLocalStorage()) return makeEmptyDay(ymd);

  const key = `${KEY_PREFIX}${ymd}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return makeEmptyDay(ymd);

  const parsed = safeJsonParse(raw);
  if (!isAchieveDay(parsed)) return makeEmptyDay(ymd);

  if (parsed.ymd !== ymd) return makeEmptyDay(ymd);

  return parsed;
}

export function saveDay(day: AchieveDay): void {
  if (!hasLocalStorage()) return;

  const key = `${KEY_PREFIX}${day.ymd}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(day));
  } catch {
    // storage が満杯などでもアプリが落ちないようにする
  }
}

export function removeDay(ymd: string): void {
  if (!hasLocalStorage()) return;

  const key = `${KEY_PREFIX}${ymd}`;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    const c = crypto as Crypto;
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * localStorage に保存されている「日付データ」を列挙して返す（新しい日付が先）
 * - SSRでは使えない（ブラウザ専用）
 */
export function listDays(): AchieveDay[] {
  if (!hasLocalStorage()) return [];

  const days: AchieveDay[] = [];
  const ls = window.localStorage;

  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (!key) continue;
    if (!key.startsWith(KEY_PREFIX)) continue;

    const raw = ls.getItem(key);
    if (!raw) continue;

    const parsed = safeJsonParse(raw);
    if (!isAchieveDay(parsed)) continue;

    days.push(parsed);
  }

  days.sort((a, b) => b.ymd.localeCompare(a.ymd));
  return days;
}
