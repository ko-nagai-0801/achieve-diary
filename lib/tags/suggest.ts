/* lib/tags/suggest.ts */
import { extractTags, type TagAliases } from "@/lib/diary";
import type { DayEntry } from "@/lib/storage";

export type TagSuggestion = {
  tag: string; // canonical tag
  totalCount: number;
  recent7Count: number;
  lastSeenYmd: string; // YYYY-MM-DD
  matchKeys: string[]; // canonical + alias keys (normalized lower)
};

function jstYmdFromDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function lastNYmds(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(jstYmdFromDate(x));
  }
  return out;
}

function invertAliases(aliases: TagAliases): Map<string, string[]> {
  const inv = new Map<string, string[]>();
  for (const [k, v] of Object.entries(aliases)) {
    const canon = v.normalize("NFKC").trim();
    if (!canon) continue;
    const arr = inv.get(canon) ?? [];
    arr.push(k.normalize("NFKC").trim().toLowerCase());
    inv.set(canon, arr);
  }
  return inv;
}

export function buildTagSuggestions(entries: DayEntry[], aliases: TagAliases): TagSuggestion[] {
  const inv = invertAliases(aliases);
  const recentSet = new Set<string>(lastNYmds(7));

  const stat = new Map<string, { total: number; recent7: number; lastSeen: string }>();

  for (const e of entries) {
    const isRecent7 = recentSet.has(e.ymd);

    for (const it of e.day.items) {
      const tags = extractTags(it.text, aliases);
      for (const t of tags) {
        const cur = stat.get(t) ?? { total: 0, recent7: 0, lastSeen: "" };
        cur.total += 1;
        if (isRecent7) cur.recent7 += 1;
        if (!cur.lastSeen || e.ymd > cur.lastSeen) cur.lastSeen = e.ymd;
        stat.set(t, cur);
      }
    }
  }

  const arr: TagSuggestion[] = Array.from(stat.entries()).map(([tag, s]) => ({
    tag,
    totalCount: s.total,
    recent7Count: s.recent7,
    lastSeenYmd: s.lastSeen,
    matchKeys: [
      tag.normalize("NFKC").trim().toLowerCase(),
      ...(inv.get(tag) ?? []),
    ],
  }));

  arr.sort((a, b) => {
    const ar = a.recent7Count > 0 ? 1 : 0;
    const br = b.recent7Count > 0 ? 1 : 0;
    if (br !== ar) return br - ar;
    if (b.recent7Count !== a.recent7Count) return b.recent7Count - a.recent7Count;
    if (b.lastSeenYmd !== a.lastSeenYmd) return b.lastSeenYmd.localeCompare(a.lastSeenYmd);
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return a.tag.localeCompare(b.tag);
  });

  return arr;
}
