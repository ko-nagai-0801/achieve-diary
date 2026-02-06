/* lib/diary.ts */
import type { AchieveDay, AchieveItem } from "@/lib/storage";

export type DayEntry = {
  ymd: string;
  day: AchieveDay;
  storageKey: string;
};

export type TagAliases = Record<string, string>;

export const TAG_ALIASES_KEY = "achieve:tag-aliases:v1";

/**
 * 初期の表記ゆれ辞書（必要に応じて増やす）
 * - key: エイリアス（正規化後：NFKC+trim+lower、#除去済みで想定）
 * - value: 統一したいタグ名（表示にも使われる）
 */
export const DEFAULT_TAG_ALIASES: TagAliases = {
  // ひらがな → 漢字/用語
  けんこう: "健康",
  べんきょう: "学習",
  じむ: "事務",

  // 英語 → 日本語
  health: "健康",
  study: "学習",
  work: "仕事",
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

export function normalizeAliasKey(raw: string): string {
  let q = raw.normalize("NFKC").trim();
  if (q.startsWith("#")) q = q.slice(1);

  q = q.replace(/^[\(\[【「『（]+/g, "");
  q = q.replace(/[\)\]\}】」』）、。．.,!?:;！？]+$/g, "");

  return q.trim().toLowerCase();
}

export function normalizeAliasValue(raw: string): string {
  return raw.normalize("NFKC").trim();
}

export function loadTagAliases(storage: Storage): TagAliases {
  const raw = storage.getItem(TAG_ALIASES_KEY);
  if (!raw) return { ...DEFAULT_TAG_ALIASES };

  try {
    const parsed: unknown = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { ...DEFAULT_TAG_ALIASES };

    const out: TagAliases = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== "string" || typeof v !== "string") continue;
      const nk = normalizeAliasKey(k);
      const nv = normalizeAliasValue(v);
      if (!nk || !nv) continue;
      out[nk] = nv;
    }

    // 保存データが空ならデフォルトに戻す
    if (Object.keys(out).length === 0) return { ...DEFAULT_TAG_ALIASES };

    return out;
  } catch {
    return { ...DEFAULT_TAG_ALIASES };
  }
}

export function saveTagAliases(storage: Storage, aliases: TagAliases): void {
  storage.setItem(TAG_ALIASES_KEY, JSON.stringify(aliases));
}

export function resetTagAliases(storage: Storage): TagAliases {
  const next = { ...DEFAULT_TAG_ALIASES };
  saveTagAliases(storage, next);
  return next;
}

/**
 * 生タグを辞書で正規化して返す
 * - aliasesに完全一致する場合は value を採用
 * - それ以外は key 正規化（lower）した文字列を返す
 */
export function canonicalizeTag(raw: string, aliases: TagAliases): string {
  const k = normalizeAliasKey(raw);
  if (!k) return "";
  const aliased = aliases[k];
  return aliased ? normalizeAliasValue(aliased) : k;
}

/**
 * text から #tag を抽出（複数行OK）
 * - 末尾の記号は除去
 * - 1アイテム内で同じタグが複数回出ても1回として扱う
 * - 表記ゆれ辞書で正規化して返す
 */
export function extractTags(text: string, aliases: TagAliases): string[] {
  const set = new Set<string>();
  const re = /#([^\s#]+)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let tag = m[1] ?? "";

    tag = tag.replace(/^[\(\[【「『（]+/g, "");
    tag = tag.replace(/[\)\]\}】」』）、。．.,!?:;！？]+$/g, "");

    const canon = canonicalizeTag(tag, aliases);
    if (!canon) continue;

    set.add(canon);
  }

  return Array.from(set.values());
}

export function includesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
