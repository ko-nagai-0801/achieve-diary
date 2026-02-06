/* app/history/HistoryClient.tsx */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  canonicalizeTag,
  extractTags,
  includesQuery,
  loadTagAliases,
  normalizeAliasKey,
  type TagAliases,
} from "@/lib/diary";
import { scanDaysFromStorage, type DayEntry, type AchieveItem } from "@/lib/storage";

type SearchMode = "text" | "tag";

function buildUrl(pathname: string, q: string, mode: SearchMode): string {
  const params = new URLSearchParams();
  const tq = q.trim();
  if (tq) params.set("q", tq);
  if (mode === "tag") params.set("mode", "tag");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function tagQueryCanonical(raw: string, aliases: TagAliases): string {
  const cleaned = normalizeAliasKey(raw);
  if (!cleaned) return "";
  const canon = canonicalizeTag(cleaned, aliases);
  return canon.toLowerCase();
}

function itemMatchesText(it: AchieveItem, q: string): boolean {
  return includesQuery(it.text, q);
}

function itemMatchesTag(it: AchieveItem, tagQ: string, aliases: TagAliases): boolean {
  const tags = extractTags(it.text, aliases);
  return tags.some((t) => t.toLowerCase().includes(tagQ));
}

export default function HistoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode: SearchMode = searchParams.get("mode") === "tag" ? "tag" : "text";
  const q = searchParams.get("q") ?? "";

  const [entries, setEntries] = useState<DayEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return scanDaysFromStorage(window.localStorage);
  });

  const [aliases, setAliases] = useState<TagAliases>(() => {
    if (typeof window === "undefined") return {};
    return loadTagAliases(window.localStorage);
  });

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEntries(scanDaysFromStorage(window.localStorage));
    setAliases(loadTagAliases(window.localStorage));
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const tagQ = useMemo(() => tagQueryCanonical(q, aliases), [q, aliases]);

  const filteredEntries = useMemo(() => {
    const tq = q.trim();
    if (!tq) return entries;

    if (mode === "tag") {
      if (!tagQ) return entries;
      return entries.filter((e) => e.day.items.some((it) => itemMatchesTag(it, tagQ, aliases)));
    }

    return entries.filter((e) => {
      if (includesQuery(e.ymd, tq)) return true;
      return e.day.items.some((it) => itemMatchesText(it, tq));
    });
  }, [entries, q, mode, tagQ, aliases]);

  const effectiveSelectedYmd = useMemo(() => {
    const list = q.trim() ? filteredEntries : entries;
    if (list.length === 0) return null;
    if (selectedYmd && list.some((e) => e.ymd === selectedYmd)) return selectedYmd;
    return list[0]?.ymd ?? null;
  }, [entries, filteredEntries, q, selectedYmd]);

  const selected = useMemo(() => {
    if (!effectiveSelectedYmd) return null;
    return entries.find((e) => e.ymd === effectiveSelectedYmd) ?? null;
  }, [entries, effectiveSelectedYmd]);

  const visibleItems = useMemo(() => {
    if (!selected) return [];
    const tq = q.trim();
    if (!tq) return selected.day.items;

    if (mode === "tag") {
      if (!tagQ) return selected.day.items;
      return selected.day.items.filter((it) => itemMatchesTag(it, tagQ, aliases));
    }

    return selected.day.items.filter((it) => itemMatchesText(it, tq));
  }, [selected, q, mode, tagQ, aliases]);

  function setQueryToUrl(next: string) {
    router.replace(buildUrl(pathname, next, mode));
  }

  function setModeToUrl(nextMode: SearchMode) {
    router.replace(buildUrl(pathname, q, nextMode));
  }

  const [showSuggest, setShowSuggest] = useState<boolean>(false);

  const tagSuggestions = useMemo(() => {
    if (entries.length === 0) return [];

    const count = new Map<string, number>();
    for (const e of entries) {
      for (const it of e.day.items) {
        const tags = extractTags(it.text, aliases);
        for (const t of tags) count.set(t, (count.get(t) ?? 0) + 1);
      }
    }

    const inv = new Map<string, string[]>();
    for (const [k, v] of Object.entries(aliases)) {
      const canon = v.trim();
      if (!canon) continue;
      const arr = inv.get(canon) ?? [];
      arr.push(k);
      inv.set(canon, arr);
    }

    const input = normalizeAliasKey(q);
    const items = Array.from(count.entries()).map(([tag, c]) => ({
      tag,
      count: c,
      matchKeys: [tag.toLowerCase(), ...(inv.get(tag) ?? [])],
    }));

    items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });

    const filtered =
      mode !== "tag"
        ? []
        : items.filter((x) => {
            if (!input) return true;
            return x.matchKeys.some((k) => k.includes(input));
          });

    return filtered.slice(0, 8);
  }, [entries, aliases, q, mode]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">履歴</h1>
          <p className="mt-1 text-sm text-zinc-400">localStorage から読み取り、検索・詳細表示します。</p>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="shrink-0 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          更新
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">日付一覧</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {q.trim() ? `検索結果：${filteredEntries.length} 日` : `全体：${entries.length} 日`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative w-full">
                <input
                  value={q}
                  onChange={(e) => setQueryToUrl(e.target.value)}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setShowSuggest(false)}
                  placeholder={mode === "tag" ? "タグ検索（例：#健康 / けんこう / health）" : "本文検索（例：散歩 / 洗い物）"}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                />

                {mode === "tag" && showSuggest && tagSuggestions.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-lg">
                    <p className="px-2 pb-1 text-xs text-zinc-500">タグ候補</p>
                    <ul className="space-y-1">
                      {tagSuggestions.map((s) => (
                        <li key={s.tag}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setQueryToUrl(`#${s.tag}`);
                              setShowSuggest(false);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-900"
                          >
                            <span className="truncate">#{s.tag}</span>
                            <span className="ml-3 shrink-0 text-xs text-zinc-400">× {s.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setQueryToUrl("")}
                disabled={!q.trim()}
                className="shrink-0 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 disabled:opacity-60 hover:bg-zinc-900"
              >
                クリア
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">検索対象</span>
              <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/40 p-1">
                <button
                  type="button"
                  onClick={() => setModeToUrl("text")}
                  className={
                    "rounded-lg px-3 py-1.5 text-xs transition " +
                    (mode === "text" ? "bg-zinc-200 text-zinc-900" : "text-zinc-200 hover:bg-zinc-900")
                  }
                >
                  本文
                </button>
                <button
                  type="button"
                  onClick={() => setModeToUrl("tag")}
                  className={
                    "rounded-lg px-3 py-1.5 text-xs transition " +
                    (mode === "tag" ? "bg-zinc-200 text-zinc-900" : "text-zinc-200 hover:bg-zinc-900")
                  }
                >
                  タグ
                </button>
              </div>

              {mode === "tag" ? <p className="text-xs text-zinc-500">※表記ゆれ辞書で統一（/insightsで編集）</p> : null}
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
              {q.trim() ? "一致する履歴がありません。" : "まだ履歴がありません。/today で追加してみましょう。"}
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {filteredEntries.map((e) => {
                const total = e.day.items.length;
                const active = e.ymd === effectiveSelectedYmd;

                return (
                  <li key={e.ymd}>
                    <button
                      type="button"
                      onClick={() => setSelectedYmd(e.ymd)}
                      className={
                        "w-full rounded-xl border px-3 py-2 text-left transition " +
                        (active ? "border-zinc-600 bg-zinc-950/60" : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-zinc-100">{e.ymd}</p>
                        <p className="text-xs text-zinc-400">{total}件</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">詳細</h2>

          {!selected ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
              左の一覧から日付を選ぶと、詳細が表示されます。
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-sm font-semibold text-zinc-100">{selected.ymd}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  合計 {selected.day.items.length} 件
                  {q.trim() ? ` / ヒット ${visibleItems.length} 件` : ""}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <h3 className="text-xs font-semibold text-zinc-200">できたこと</h3>

                {visibleItems.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-400">
                    {q.trim() ? "この日に一致する項目がありません。" : "項目がありません。"}
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {visibleItems.map((it) => (
                      <li key={it.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                        <p className="whitespace-pre-wrap break-words text-zinc-100">{it.text}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(it.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-3 text-xs text-zinc-500">
                  ※改行表示：<span className="font-semibold">whitespace-pre-wrap</span> を使用
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
