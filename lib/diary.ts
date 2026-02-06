/* lib/diary.ts */
import type { AchieveDay, AchieveItem } from "@/lib/storage";

export type DayEntry = {
  ymd: string;
  day: AchieveDay;
  storageKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isItem(value: unknown): value is AchieveItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.done === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isDay(value: unknown): value is AchieveDay {
  if (!isRecord(value)) return false;
  if (typeof value.ymd !== "string") return false;
  if (!Array.isArray(value.items)) return false;
  if (!value.items.every(isItem)) return false;
  return true;
}

export function scanDaysFromStorage(storage: Storage): DayEntry[] {
  const out: DayEntry[] = [];

  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k) continue;

    const raw = storage.getItem(k);
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      continue;
    }

    if (!isDay(parsed)) continue;

    out.push({
      ymd: parsed.ymd,
      day: parsed,
      storageKey: k,
    });
  }

  // ymdが重複した場合は最初の1件を採用
  const map = new Map<string, DayEntry>();
  for (const e of out) {
    if (!map.has(e.ymd)) map.set(e.ymd, e);
  }

  return Array.from(map.values()).sort((a, b) => b.ymd.localeCompare(a.ymd));
}

function normalizeTag(raw: string): string {
  const t = raw.normalize("NFKC").trim();
  return t.toLowerCase();
}

/**
 * text から #tag を抽出（複数行OK）
 * - 末尾の記号は除去
 * - 1アイテム内で同じタグが複数回出ても1回として扱う
 */
export function extractTags(text: string): string[] {
  const set = new Set<string>();

  const re = /#([^\s#]+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    let tag = m[1] ?? "";

    // 前後の括弧/記号をざっくり除去
    tag = tag.replace(/^[\(\[【「『（]+/g, "");
    tag = tag.replace(/[\)\]\}】」』）、。．.,!?:;！？]+$/g, "");

    const n = normalizeTag(tag);
    if (!n) continue;

    set.add(n);
  }

  return Array.from(set.values());
}

export function includesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return haystack.toLowerCase().includes(q);
}
