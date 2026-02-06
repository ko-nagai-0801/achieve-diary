/* app/insights/InsightsClient.tsx */
"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getDaysCached,
  subscribeDays,
  refreshDaysCache,
  type DayEntry,
} from "@/lib/storage";

function getServerSnapshot(): DayEntry[] {
  return [];
}

type Insights = {
  totalDays: number;
  totalItems: number;
  avgItemsPerDay: number;
  topWords: Array<{ word: string; count: number }>;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u3000\s]+/g, " ")
    .split(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export default function InsightsClient() {
  const entries = useSyncExternalStore(subscribeDays, getDaysCached, getServerSnapshot);

  const insights = useMemo<Insights>(() => {
    const totalDays = entries.length;
    let totalItems = 0;

    const wordCount = new Map<string, number>();

    for (const e of entries) {
      totalItems += e.day.items.length;
      for (const it of e.day.items) {
        for (const w of tokenize(it.text)) {
          wordCount.set(w, (wordCount.get(w) ?? 0) + 1);
        }
      }
    }

    const avgItemsPerDay = totalDays === 0 ? 0 : totalItems / totalDays;

    const topWords = Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return { totalDays, totalItems, avgItemsPerDay, topWords };
  }, [entries]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Insights</h2>
          <p className="text-sm opacity-80">全データを集計（{insights.totalDays}日）</p>
        </div>

        <button
          className="h-9 rounded-md border px-3 text-sm hover:opacity-80"
          onClick={() => refreshDaysCache()}
          type="button"
        >
          再集計
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-3">
          <div className="text-sm opacity-80">総日数</div>
          <div className="mt-1 text-2xl font-semibold">{insights.totalDays}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm opacity-80">総できたこと</div>
          <div className="mt-1 text-2xl font-semibold">{insights.totalItems}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm opacity-80">1日平均</div>
          <div className="mt-1 text-2xl font-semibold">{insights.avgItemsPerDay.toFixed(2)}</div>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">よく出るワード（簡易）</div>
        {insights.topWords.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">まだ集計できるデータがありません。</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {insights.topWords.map((x) => (
              <li
                key={x.word}
                className="flex items-baseline justify-between border-b pb-1"
              >
                <span className="text-sm">{x.word}</span>
                <span className="text-sm opacity-80">{x.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
