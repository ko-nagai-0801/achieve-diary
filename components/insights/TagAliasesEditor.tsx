/* components/insights/TagAliasesEditor.tsx */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runIdle, type CancelFn } from "@/lib/client-scheduler";
import {
  normalizeAliasKey,
  normalizeAliasValue,
  type TagAliases,
} from "@/lib/diary";
import { useTagAliases } from "@/lib/useTagAliases";
import {
  resetTagAliasesAndNotify,
  saveTagAliasesAndNotify,
} from "@/lib/aliases-store";

type Row = {
  id: string;
  key: string; // alias (raw editable)
  value: string; // canonical tag (raw editable)
};

function createRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toRows(aliases: TagAliases): Row[] {
  return Object.entries(aliases)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({
      id: createRowId(),
      key: k,
      value: v,
    }));
}

function rowsToAliases(rows: Row[]): TagAliases {
  const out: TagAliases = {};
  for (const r of rows) {
    const k = normalizeAliasKey(r.key);
    const v = normalizeAliasValue(r.value);
    if (!k || !v) continue;
    out[k] = v;
  }
  return out;
}

function shallowEqualAliases(a: TagAliases, b: TagAliases): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export default function TagAliasesEditor() {
  const { aliases, isLoading, requestRefresh } = useTagAliases({
    enabled: true,
    refreshOnMount: true,
    refreshOnFocus: true,
    refreshOnVisible: true,
    throttleMs: 500,
  });

  const [rows, setRows] = useState<Row[]>(() => toRows(aliases));
  const [dirty, setDirty] = useState<boolean>(false);

  // store更新 → editorへ反映（dirty中は上書きしない）
  const syncJobCancelRef = useRef<CancelFn | null>(null);

  useEffect(() => {
    if (dirty) return;

    if (syncJobCancelRef.current) syncJobCancelRef.current();

    syncJobCancelRef.current = runIdle(() => {
      syncJobCancelRef.current = null;
      setRows(toRows(aliases));
    });

    return () => {
      if (syncJobCancelRef.current) syncJobCancelRef.current();
      syncJobCancelRef.current = null;
    };
  }, [aliases, dirty]);

  const currentAliases = useMemo(() => rowsToAliases(rows), [rows]);

  const hasDiffFromStore = useMemo(() => {
    return !shallowEqualAliases(currentAliases, aliases);
  }, [currentAliases, aliases]);

  const validation = useMemo(() => {
    const normalizedPairs = rows
      .map((r) => ({
        id: r.id,
        nk: normalizeAliasKey(r.key),
        nv: normalizeAliasValue(r.value),
      }))
      .filter((x) => x.nk && x.nv);

    const dup = new Map<string, number>();
    for (const p of normalizedPairs) {
      dup.set(p.nk, (dup.get(p.nk) ?? 0) + 1);
    }

    const duplicatedKeys = Array.from(dup.entries())
      .filter(([, c]) => c >= 2)
      .map(([k]) => k);

    const invalidCount =
      rows.length -
      rows.filter((r) => normalizeAliasKey(r.key) && normalizeAliasValue(r.value)).length;

    return {
      invalidCount,
      duplicatedKeys,
      canSave: duplicatedKeys.length === 0,
    };
  }, [rows]);

  const setRow = useCallback((id: string, patch: Partial<Pick<Row, "key" | "value">>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setDirty(true);
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [{ id: createRowId(), key: "", value: "" }, ...prev]);
    setDirty(true);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    if (typeof window === "undefined") return;

    const next = rowsToAliases(rows);
    saveTagAliasesAndNotify(window.localStorage, next);

    // 保存直後はdirty解除（storeが即通知→aliases更新→effectでrows同期される）
    setDirty(false);
  }, [rows]);

  const reset = useCallback(() => {
    if (typeof window === "undefined") return;

    const next = resetTagAliasesAndNotify(window.localStorage);

    // 即時反映したいので rows も更新（effect内同期setStateは避ける）
    window.setTimeout(() => {
      setRows(toRows(next));
      setDirty(false);
    }, 0);
  }, []);

  const revertToStore = useCallback(() => {
    // storeの現状に戻す（保存はしない）
    setRows(toRows(aliases));
    setDirty(false);
  }, [aliases]);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">表記ゆれ辞書（タグ統一）</h3>
          <p className="mt-1 text-xs text-zinc-500">
            例：<span className="font-semibold">health</span> → <span className="font-semibold">健康</span>
            （保存後、同一タブ内も即反映）
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => requestRefresh({ force: true, immediate: true })}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
          >
            再読み込み
          </button>

          <button
            type="button"
            onClick={addRow}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
          >
            追加
          </button>

          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
          >
            初期値に戻す
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
          読み込み中…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-zinc-500">
              {validation.invalidCount > 0 ? (
                <span className="text-zinc-300">
                  空欄が {validation.invalidCount} 行あります（保存時は無視されます）
                </span>
              ) : (
                <span>空欄なし</span>
              )}
              {validation.duplicatedKeys.length > 0 ? (
                <span className="ml-2 text-red-300">
                  重複キー：{validation.duplicatedKeys.join(", ")}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {dirty && hasDiffFromStore ? (
                <button
                  type="button"
                  onClick={revertToStore}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                >
                  変更を破棄
                </button>
              ) : null}

              <button
                type="button"
                onClick={save}
                disabled={!dirty || !hasDiffFromStore || !validation.canSave}
                className="rounded-xl bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-60"
              >
                保存
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
              まだ辞書がありません。「追加」から登録できます。
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto] sm:items-center">
                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-500">エイリアス（key）</div>
                      <input
                        value={r.key}
                        onChange={(e) => setRow(r.id, { key: e.target.value })}
                        placeholder="例：health / けんこう"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                      />
                      <div className="text-[11px] text-zinc-500">
                        正規化後：<span className="text-zinc-300">{normalizeAliasKey(r.key) || "—"}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-500">統一タグ（value）</div>
                      <input
                        value={r.value}
                        onChange={(e) => setRow(r.id, { value: e.target.value })}
                        placeholder="例：健康 / 学習"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                      />
                      <div className="text-[11px] text-zinc-500">
                        正規化後：<span className="text-zinc-300">{normalizeAliasValue(r.value) || "—"}</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
