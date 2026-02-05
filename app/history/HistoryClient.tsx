/* app/history/HistoryClient.tsx */
"use client";

import { useMemo, useState } from "react";
import { formatJstLong, formatJstYmd } from "@/lib/jst";
import { listDays, type AchieveDay } from "@/lib/storage";

type Period = "all" | "week" | "month";

function ymdToDateJst(ymd: string): Date {
  // "YYYY-MM-DD" -> JST固定のDateとして扱う
  return new Date(`${ymd}T00:00:00+09:00`);
}

function withinLastDays(ymd: string, days: number): boolean {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1)); // 7日なら「今日含めて7日」
  const d = ymdToDateJst(ymd);
  return d.getTime() >= start.getTime();
}

function formatYmdDisplay(ymd: string): string {
  const d = ymdToDateJst(ymd);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

function summarize(day: AchieveDay) {
  const total = day.items.length;
  const checked = day.items.filter((i) => i.done).length;
  const preview = day.items.slice(0, 2).map((i) => i.text);
  return { total, checked, preview };
}

export default function HistoryClient() {
  const todayYmd = useMemo(() => formatJstYmd(), []);
  const todayLong = useMemo(() => formatJstLong(), []);

  // 初回レンダーで localStorage を読む（effect不要）
  const [days] = useState<AchieveDay[]>(() => listDays());
  const [query, setQuery] = useState<string>("");
  const [period, setPeriod] = useState<Period>("all");
  const [expandedYmd, setExpandedYmd] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    const qLower = q.toLowerCase();

    return days.filter((day) => {
      if (period === "week" && !withinLastDays(day.ymd, 7)) return false;
      if (period === "month" && !withinLastDays(day.ymd, 30)) return false;

      if (!q) return true;

      // MVP: 本文（できたことテキスト）に含まれるかで検索
      return day.items.some((it) => it.text.toLowerCase().includes(qLower));
    });
  }, [days, period, query]);

  function toggleExpand(ymd: string) {
    setExpandedYmd((prev) => (prev === ymd ? null : ymd));
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-400">{todayYmd}</p>
        <h1 className="text-2xl font-semibold tracking-tight">履歴</h1>
        <p className="text-zinc-300">
          過去の「できたこと」を検索・見返せます。
        </p>
        <p className="text-sm text-zinc-400">{todayLong}</p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full">
            <h2 className="text-sm font-semibold text-zinc-200">検索</h2>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="検索（例：#健康 / 散歩 / 片付け）"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              />
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                クリア
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className={
                period === "week"
                  ? "rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
                  : "rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              }
            >
              直近7日
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className={
                period === "month"
                  ? "rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
                  : "rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              }
            >
              直近30日
            </button>
            <button
              type="button"
              onClick={() => setPeriod("all")}
              className={
                period === "all"
                  ? "rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900"
                  : "rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
              }
            >
              すべて
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          表示：{filtered.length}日 / 保存：{days.length}日
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">日付一覧</h2>

        {days.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            まだ履歴がありません。/today で追加すると、ここに並びます。
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            条件に一致する履歴がありません。
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {filtered.map((day) => {
              const s = summarize(day);
              const expanded = expandedYmd === day.ymd;

              return (
                <li key={day.ymd}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(day.ymd)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-left hover:bg-zinc-950/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-400">{day.ymd}</p>
                        <p className="mt-1 break-words text-base font-semibold text-zinc-100">
                          {formatYmdDisplay(day.ymd)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs text-zinc-400">
                          {s.total}件 / チェック{s.checked}件
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {expanded ? "閉じる" : "開く"}
                        </p>
                      </div>
                    </div>

                    {s.preview.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {s.preview.map((t, idx) => (
                          <p
                            key={`${day.ymd}-pv-${idx}`}
                            className="truncate text-sm text-zinc-300"
                          >
                            ・{t}
                          </p>
                        ))}
                      </div>
                    )}
                  </button>

                  {expanded && (
                    <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4">
                      {day.items.length === 0 ? (
                        <p className="text-sm text-zinc-400">
                          この日はまだ項目がありません。
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {day.items.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                            >
                              <span className="mt-0.5 text-sm text-zinc-400">
                                {it.done ? "✓" : "・"}
                              </span>
                              <p
                                className={
                                  it.done
                                    ? "min-w-0 break-words text-sm text-zinc-400 line-through"
                                    : "min-w-0 break-words text-sm text-zinc-100"
                                }
                              >
                                {it.text}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
