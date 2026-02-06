/* app/history/HistoryClient.tsx */
"use client";

import { useEffect, useMemo, useState } from "react";
import { includesQuery, scanDaysFromStorage, type DayEntry } from "@/lib/diary";
import type { AchieveItem } from "@/lib/storage";

function countDone(items: AchieveItem[]): number {
  return items.filter((i) => i.done).length;
}

export default function HistoryClient() {
  const [entries, setEntries] = useState<DayEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return scanDaysFromStorage(window.localStorage);
  });

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");

  function refresh() {
    const next = scanDaysFromStorage(window.localStorage);
    setEntries(next);

    if (selectedYmd && !next.some((e) => e.ymd === selectedYmd)) {
      setSelectedYmd(null);
    }
  }

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
    // refreshはイベントから呼ぶ（useEffect内で直接setStateしない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYmd]);

  const q = query.trim();

  const filteredEntries = useMemo(() => {
    if (!q) return entries;

    return entries.filter((e) => {
      if (includesQuery(e.ymd, q)) return true;
      return e.day.items.some((it) => includesQuery(it.text, q));
    });
  }, [entries, q]);

  const selected = useMemo(() => {
    if (!selectedYmd) return null;
    return entries.find((e) => e.ymd === selectedYmd) ?? null;
  }, [entries, selectedYmd]);

  const selectedVisibleItems = useMemo(() => {
    if (!selected) return [];
    if (!q) return selected.day.items;
    return selected.day.items.filter((it) => includesQuery(it.text, q));
  }, [selected, q]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">履歴</h1>
          <p className="mt-1 text-sm text-zinc-400">
            localStorage から日付を読み取り、検索・詳細表示します。
          </p>
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
                {q ? `検索結果：${filteredEntries.length} 日` : `全体：${entries.length} 日`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索（例：散歩 / #健康 / 洗い物）"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <button
              type="button"
              onClick={() => setQuery("")}
              disabled={!q}
              className="shrink-0 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 disabled:opacity-60 hover:bg-zinc-900"
            >
              クリア
            </button>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
              {q ? "一致する履歴がありません。" : "まだ履歴がありません。/today で追加してみましょう。"}
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {filteredEntries.map((e) => {
                const total = e.day.items.length;
                const done = countDone(e.day.items);
                const active = e.ymd === selectedYmd;

                return (
                  <li key={e.ymd}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedYmd((prev) => (prev === e.ymd ? null : e.ymd))
                      }
                      className={
                        "w-full rounded-xl border px-3 py-2 text-left transition " +
                        (active
                          ? "border-zinc-600 bg-zinc-950/60"
                          : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-zinc-100">{e.ymd}</p>
                        <p className="text-xs text-zinc-400">
                          {done}/{total}
                        </p>
                      </div>

                      {/* ✅ key表示は本番では非表示（削除済み） */}
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
                  合計 {selected.day.items.length} 件 / 完了 {countDone(selected.day.items)} 件
                  {q ? ` / 検索ヒット ${selectedVisibleItems.length} 件` : ""}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <h3 className="text-xs font-semibold text-zinc-200">できたこと</h3>

                {selectedVisibleItems.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-400">
                    {q ? "この日に一致する項目がありません。" : "項目がありません。"}
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selectedVisibleItems.map((it) => (
                      <li
                        key={it.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                      >
                        <p
                          className={
                            it.done
                              ? "whitespace-pre-wrap break-words text-zinc-400 line-through"
                              : "whitespace-pre-wrap break-words text-zinc-100"
                          }
                        >
                          {it.text}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(it.createdAt).toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-3 text-xs text-zinc-500">
                  ※改行表示：<span className="font-semibold">whitespace-pre-wrap</span>{" "}
                  を使用
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
