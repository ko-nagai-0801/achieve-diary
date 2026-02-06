/* app/insights/InsightsClient.tsx */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runIdle, type CancelFn } from "@/lib/client-scheduler";
import { useDaysData } from "@/lib/useDaysData";
import type { DayEntry } from "@/lib/storage";
import TagAliasesEditor from "@/components/insights/TagAliasesEditor";

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

function computeInsights(entries: DayEntry[]): Insights {
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
}

export default function InsightsClient() {
  const { entries, isLoading, refreshNow } = useDaysData({
    enabled: true,
    refreshOnMount: true,
    refreshOnFocus: true,
    refreshOnVisible: true,
    throttleMs: 500,
  });

  const [insights, setInsights] = useState<Insights>({
    totalDays: 0,
    totalItems: 0,
    avgItemsPerDay: 0,
    topWords: [],
  });

  const computeJobCancelRef = useRef<CancelFn | null>(null);

  useEffect(() => {
    if (!entries) return;

    if (computeJobCancelRef.current) computeJobCancelRef.current();
    computeJobCancelRef.current = runIdle(() => {
      computeJobCancelRef.current = null;
      setInsights(computeInsights(entries));
    });

    return () => {
      if (computeJobCancelRef.current) computeJobCancelRef.current();
      computeJobCancelRef.current = null;
    };
  }, [entries]);

  const isComputing = useMemo(() => {
    if (isLoading) return true;
    if (!entries) return true;
    return insights.totalDays !== entries.length;
  }, [isLoading, entries, insights.totalDays]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Insights</h2>
          <p className="text-sm opacity-80">
            {isComputing ? "集計中…" : `全データを集計（${insights.totalDays}日）`}
          </p>
        </div>

        <button
          className="h-9 rounded-md border px-3 text-sm hover:opacity-80"
          onClick={() => refreshNow()}
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
        {isComputing ? (
          <p className="mt-2 text-sm opacity-80">集計中です…</p>
        ) : insights.topWords.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">まだ集計できるデータがありません。</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {insights.topWords.map((x) => (
              <li key={x.word} className="flex items-baseline justify-between border-b pb-1">
                <span className="text-sm">{x.word}</span>
                <span className="text-sm opacity-80">{x.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ✅ 辞書編集：保存後に notifyTagAliasesMutated() を呼ぶことで同一タブ即反映 */}
      <TagAliasesEditor />
    </section>
  );
}
