/* app/insights/InsightsClient.tsx */
"use client";

import { useEffect, useMemo, useState } from "react";
import { extractTags, scanDaysFromStorage, type DayEntry } from "@/lib/diary";
import type { AchieveItem } from "@/lib/storage";

type TagCount = {
  tag: string;
  count: number;
};

function countDone(items: AchieveItem[]): number {
  return items.filter((i) => i.done).length;
}

export default function InsightsClient() {
  const [entries, setEntries] = useState<DayEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return scanDaysFromStorage(window.localStorage);
  });

  function refresh() {
    setEntries(scanDaysFromStorage(window.localStorage));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const days = entries.length;

    let totalItems = 0;
    let doneItems = 0;

    for (const e of entries) {
      totalItems += e.day.items.length;
      doneItems += countDone(e.day.items);
    }

    return { days, totalItems, doneItems };
  }, [entries]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();

    for (const e of entries) {
      for (const it of e.day.items) {
        const tags = extractTags(it.text);
        for (const t of tags) {
          map.set(t, (map.get(t) ?? 0) + 1);
        }
      }
    }

    const arr: TagCount[] = Array.from(map.entries()).map(([tag, count]) => ({
      tag,
      count,
    }));

    arr.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });

    return arr.slice(0, 12);
  }, [entries]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">インサイト</h1>
          <p className="mt-1 text-sm text-zinc-400">
            localStorage から集計します（#タグ上位など）。
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

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-400">日数</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.days}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-400">合計アイテム</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.totalItems}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-400">完了</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.doneItems}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">タグ上位（#tag）</h2>
        <p className="mt-1 text-xs text-zinc-500">
          ※1アイテム内で同じタグが複数回出ても1回としてカウント
        </p>

        {topTags.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            まだタグがありません。/today で「#健康」などを付けてみましょう。
          </div>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {topTags.map((t) => (
              <li
                key={t.tag}
                className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-sm text-zinc-100"
              >
                <span className="text-zinc-100">#{t.tag}</span>{" "}
                <span className="text-xs text-zinc-400">× {t.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">ヒント</h2>
        <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap break-words">
          例：
          {"\n"}・散歩した #健康
          {"\n"}・洗い物した #家事
          {"\n"}・記事を書いた #学習
        </p>
      </section>
    </main>
  );
}
