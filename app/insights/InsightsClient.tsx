/* app/insights/InsightsClient.tsx */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_TAG_ALIASES,
  extractTags,
  loadTagAliases,
  normalizeAliasKey,
  normalizeAliasValue,
  resetTagAliases,
  saveTagAliases,
  scanDaysFromStorage,
  type DayEntry,
  type TagAliases,
} from "@/lib/diary";

type TagCount = {
  tag: string;
  count: number;
};

type Range = "all" | "7" | "30";

function jstYmdFromDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function jstMdFromYmd(ymd: string): string {
  // YYYY-MM-DD -> MM/DD
  return `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}`;
}

function cutoffYmdForRange(range: Range): string | null {
  if (range === "all") return null;
  const days = range === "7" ? 7 : 30;

  const d = new Date();
  d.setDate(d.getDate() - (days - 1)); // 今日含めてN日
  return jstYmdFromDate(d);
}

function last7Ymds(): string[] {
  const out: string[] = [];
  const d = new Date();
  // 6日前 → 今日 の順（左から右へ）
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(jstYmdFromDate(x));
  }
  return out;
}

type AliasRow = { key: string; value: string };

function aliasesToRows(aliases: TagAliases): AliasRow[] {
  return Object.entries(aliases)
    .map(([k, v]) => ({ key: k, value: v }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function rowsToAliases(rows: AliasRow[]): TagAliases {
  const out: TagAliases = {};
  for (const r of rows) {
    const k = normalizeAliasKey(r.key);
    const v = normalizeAliasValue(r.value);
    if (!k || !v) continue;
    out[k] = v;
  }
  return out;
}

export default function InsightsClient() {
  const router = useRouter();

  const [entries, setEntries] = useState<DayEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return scanDaysFromStorage(window.localStorage);
  });

  const [aliases, setAliases] = useState<TagAliases>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_TAG_ALIASES };
    return loadTagAliases(window.localStorage);
  });

  const [range, setRange] = useState<Range>("all");

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

  const filteredEntries = useMemo(() => {
    const cutoff = cutoffYmdForRange(range);
    if (!cutoff) return entries;
    return entries.filter((e) => e.ymd >= cutoff);
  }, [entries, range]);

  const summary = useMemo(() => {
    const days = filteredEntries.length;
    let totalItems = 0;
    for (const e of filteredEntries) totalItems += e.day.items.length;
    return { days, totalItems };
  }, [filteredEntries]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();

    for (const e of filteredEntries) {
      for (const it of e.day.items) {
        const tags = extractTags(it.text, aliases);
        for (const t of tags) map.set(t, (map.get(t) ?? 0) + 1);
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
  }, [filteredEntries, aliases]);

  function rangeLabel(r: Range): string {
    if (r === "7") return "直近7日";
    if (r === "30") return "直近30日";
    return "全期間";
  }

  function goHistoryByTag(tag: string) {
    router.push(`/history?q=${encodeURIComponent(`#${tag}`)}&mode=tag`);
  }

  // ===== タグ辞書モーダル =====
  const [dictOpen, setDictOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<AliasRow[]>(() => aliasesToRows(aliases));

  function openDict() {
    setRows(aliasesToRows(aliases));
    setDictOpen(true);
  }

  function closeDict() {
    setDictOpen(false);
  }

  function saveDict() {
    const next = rowsToAliases(rows);
    setAliases(next);
    saveTagAliases(window.localStorage, next);
    setDictOpen(false);
  }

  function resetDict() {
    const next = resetTagAliases(window.localStorage);
    setAliases(next);
    setRows(aliasesToRows(next));
  }

  // ===== タグ推移（直近7日：日別バッジ）=====
  const trend = useMemo(() => {
    const ymds = last7Ymds();
    const byYmd = new Map<string, DayEntry>();
    for (const e of entries) byYmd.set(e.ymd, e);

    // ymd -> tag -> count
    const dayMaps: Array<Map<string, number>> = ymds.map((ymd) => {
      const m = new Map<string, number>();
      const e = byYmd.get(ymd);
      if (!e) return m;

      for (const it of e.day.items) {
        const tags = extractTags(it.text, aliases);
        for (const t of tags) m.set(t, (m.get(t) ?? 0) + 1);
      }
      return m;
    });

    // 直近7日合計で上位5タグ
    const total = new Map<string, number>();
    for (const m of dayMaps) {
      for (const [t, c] of m.entries()) total.set(t, (total.get(t) ?? 0) + c);
    }

    const top = Array.from(total.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)))
      .slice(0, 5);

    const rows = top.map((t) => ({
      tag: t.tag,
      total: t.count,
      counts: dayMaps.map((m) => m.get(t.tag) ?? 0),
    }));

    return { ymds, rows };
  }, [entries, aliases]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">インサイト</h1>
          <p className="mt-1 text-sm text-zinc-400">
            localStorage から集計します（タグ上位・タグ推移など）。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openDict}
            className="shrink-0 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            タグ辞書
          </button>
          <button
            type="button"
            onClick={refresh}
            className="shrink-0 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            更新
          </button>
        </div>
      </header>

      {/* 期間フィルタ */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">期間</h2>
            <p className="mt-1 text-xs text-zinc-500">対象：{rangeLabel(range)}</p>
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

      <section className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-400">日数</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">{summary.days}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-400">合計アイテム</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-100">
            {summary.totalItems}
          </p>
        </div>
      </section>

      {/* タグ上位 */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">タグ上位（#tag）</h2>
        <p className="mt-1 text-xs text-zinc-500">
          ※表記ゆれ辞書で統一 / クリックで履歴のタグ検索へ
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

      {/* タグ推移（直近7日） */}
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">
          タグ別の出現推移（直近7日）
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          ※直近7日で多いタグ上位5件を表示（0の日は0）
        </p>

        {trend.rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            直近7日にタグがありません。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* 日付ヘッダ */}
            <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-2 text-xs text-zinc-500">
              <div />
              {trend.ymds.map((ymd) => (
                <div key={ymd} className="text-center">
                  {jstMdFromYmd(ymd)}
                </div>
              ))}
            </div>

            {trend.rows.map((r) => (
              <div
                key={r.tag}
                className="grid grid-cols-[120px_repeat(7,1fr)] items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => goHistoryByTag(r.tag)}
                  className="truncate text-left text-sm text-zinc-100 hover:underline"
                  title="履歴でこのタグを検索"
                >
                  #{r.tag}
                  <span className="ml-2 text-xs text-zinc-500">({r.total})</span>
                </button>

                {r.counts.map((c, idx) => (
                  <div
                    key={`${r.tag}-${idx}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/40 py-2 text-center text-sm text-zinc-100"
                  >
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* タグ辞書モーダル */}
      {dictOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeDict}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">タグ表記ゆれ辞書</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  例： <span className="font-semibold">けんこう → 健康</span> /{" "}
                  <span className="font-semibold">health → 健康</span>
                </p>
              </div>

              <button
                type="button"
                onClick={closeDict}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                閉じる
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_64px] gap-2 text-xs text-zinc-500">
                <div>別名（#の後）</div>
                <div>統一タグ</div>
                <div />
              </div>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-400">
                  辞書が空です。下の「行を追加」で登録してください。
                </div>
              ) : null}

              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_64px] gap-2">
                  <input
                    value={r.key}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...next[idx], key: e.target.value };
                      setRows(next);
                    }}
                    placeholder="例：けんこう / health"
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  />
                  <input
                    value={r.value}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setRows(next);
                    }}
                    placeholder="例：健康"
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                    className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                    title="削除"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRows([...rows, { key: "", value: "" }])}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  行を追加
                </button>
                <button
                  type="button"
                  onClick={resetDict}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  初期値に戻す
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeDict}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={saveDict}
                  className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900"
                >
                  保存
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              ※保存後、/history のタグ検索候補にも反映されます（フォーカス復帰で再読込）。
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
