/* app/insights/InsightsClient.tsx */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTags, scanDaysFromStorage, type DayEntry } from "@/lib/diary";
import type { AchieveItem } from "@/lib/storage";

type TagCount = {
  tag: string;
  count: number;
};

type Range = "all" | "7" | "30";

function countDone(items: AchieveItem[]): number {
  return items.filter((i) => i.done).length;
}

function jstYmdFromDate(d: Date): string {
  // "en-CA" は YYYY-MM-DD 形式になりやすい（JST固定）
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function cutoffYmdForRange(range: Range): string | null {
  if (range === "all") return null;
  const days = range === "7" ? 7 : 30;

  const d = new Date();
  d.setDate(d.getDate() - (days - 1)); // 今日含めてN日
  return jstYmdFromDate(d);
}

export default function InsightsClient() {
  const router = useRouter();

  const [entries, setEntries] = useState<DayEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return scanDaysFromStorage(window.localStorage);
  });

  const [range, setRange] = useState<Range>("all");

  const refresh = useCallback(() => {
    setEntries(scanDaysFromStorage(window.localStorage));
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

  const filteredEntries = useMemo(() => {
    const cutoff = cutoffYmdForRange(range);
    if (!cutoff) return entries;
    // ymd が YYYY-MM-DD なら文字列比較でOK
    return entries.filter((e) => e.ymd >= cutoff);
  }, [entries, range]);

  const summary = useMemo(() => {
    const days = filteredEntries.length;

    let totalItems = 0;
    let doneItems = 0;

    for (const e of filteredEntries) {
      totalItems += e.day.items.length;
      doneItems += countDone(e.day.items);
    }

    return { days, totalItems, doneItems };
  }, [filteredEntries]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();

    for (const e of filteredEntries) {
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
  }, [filteredEntries]);

  function rangeLabel(r: Range): string {
    if (r === "7") return "直近7日";
    if (r === "30") return "直近30日";
    return "全期間";
  }

  function goHistoryByTag(tag: string) {
    const q = `#${tag}`;
    router.push(`/history?q=${encodeURIComponent(q)}&mode=tag`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">インサイト</h1>
          <p className="mt-1 text-sm text-zinc-400">
            localStorage から集計します（タグ上位など）。
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

      {/* 期間フィルタ */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">期間</h2>
            <p className="mt-1 text-xs text-zinc-500">
              対象：{rangeLabel(range)}
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/40 p-1">
            <button
              type="button"
              onClick={() => setRange("7")}
              className={
                "rounded-lg px-3 py-1.5 text-xs transition " +
                (range === "7"
                  ? "bg-zinc-200 text-zinc-900"
                  : "text-zinc-200 hover:bg-zinc-900")
              }
            >
              7日
            </button>
            <button
              type="button"
              onClick={() => setRange("30")}
              className={
                "rounded-lg px-3 py-1.5 text-xs transition " +
                (range === "30"
                  ? "bg-zinc-200 text-zinc-900"
                  : "text-zinc-200 hover:bg-zinc-900")
              }
            >
              30日
            </button>
            <button
              type="button"
              onClick={() => setRange("all")}
              className={
                "rounded-lg px-3 py-1.5 text-xs transition " +
                (range === "all"
                  ? "bg-zinc-200 text-zinc-900"
                  : "text-zinc-200 hover:bg-zinc-900")
              }
            >
              全部
            </button>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
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
          ※1アイテム内で同じタグが複数回出ても1回としてカウント / クリックで履歴検索へ
        </p>

        {topTags.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            まだタグがありません。/today で「#健康」などを付けてみましょう。
          </div>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {topTags.map((t) => (
              <li key={t.tag}>
                <button
                  type="button"
                  onClick={() => goHistoryByTag(t.tag)}
                  className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-900"
                  title="履歴でこのタグを検索"
                >
                  <span className="text-zinc-100">#{t.tag}</span>{" "}
                  <span className="text-xs text-zinc-400">× {t.count}</span>
                </button>
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
