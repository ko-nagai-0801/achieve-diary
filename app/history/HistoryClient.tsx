/* app/history/HistoryClient.tsx */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { AchieveDay, AchieveItem } from "@/lib/storage";

type DayEntry = {
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

function scanDaysFromLocalStorage(): DayEntry[] {
  const out: DayEntry[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;

    const raw = window.localStorage.getItem(k);
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

  // ymd重複があれば最初の1件を採用（キー命名が異なる場合に備える）
  const map = new Map<string, DayEntry>();
  for (const e of out) {
    if (!map.has(e.ymd)) map.set(e.ymd, e);
  }

  return Array.from(map.values()).sort((a, b) => b.ymd.localeCompare(a.ymd));
}

export default function HistoryClient() {
  const [entries, setEntries] = useState<DayEntry[]>(() =>
    typeof window === "undefined" ? [] : scanDaysFromLocalStorage(),
  );

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!selectedYmd) return null;
    return entries.find((e) => e.ymd === selectedYmd) ?? null;
  }, [entries, selectedYmd]);

  function refresh() {
    const next = scanDaysFromLocalStorage();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYmd]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">履歴</h1>
          <p className="mt-1 text-sm text-zinc-400">
            localStorage から日付を読み取り、詳細を表示します。
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
          <h2 className="text-sm font-semibold text-zinc-200">日付一覧</h2>

          {entries.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
              まだ履歴がありません。/today で追加してみましょう。
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {entries.map((e) => {
                const total = e.day.items.length;
                const checked = e.day.items.filter((i) => i.done).length;
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
                          {checked}/{total}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        key: {e.storageKey}
                      </p>
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
                <p className="text-sm font-semibold text-zinc-100">
                  {selected.ymd}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  合計 {selected.day.items.length} 件 / 完了{" "}
                  {selected.day.items.filter((i) => i.done).length} 件
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <h3 className="text-xs font-semibold text-zinc-200">できたこと</h3>
                <ul className="mt-2 space-y-2">
                  {selected.day.items.map((it) => (
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
