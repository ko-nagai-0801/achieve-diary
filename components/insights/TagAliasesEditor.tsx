/* components/insights/TagAliasesEditor.tsx */
"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  loadTagAliases,
  normalizeAliasKey,
  normalizeAliasValue,
  resetTagAliases,
  saveTagAliases,
  type TagAliases,
} from "@/lib/diary";
import {
  getTagAliasesSnapshot,
  notifyTagAliasesMutated,
  subscribeTagAliases,
} from "@/lib/aliases-store";

type Row = {
  id: string;
  key: string;
  value: string;
};

function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function rowsFromAliases(aliases: TagAliases): Row[] {
  return Object.entries(aliases)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ id: newRowId(), key: k, value: v }));
}

function toAliases(rows: Row[]): TagAliases {
  const out: TagAliases = {};
  for (const r of rows) {
    const k = normalizeAliasKey(r.key);
    const v = normalizeAliasValue(r.value);
    if (!k || !v) continue;
    out[k] = v;
  }
  return out;
}

function getServerSnapshot(): TagAliases {
  return {};
}

function getClientSnapshot(): TagAliases {
  if (typeof window === "undefined") return {};
  // storeが未ロードの初回でも表示できるようにフォールバック
  const cached = getTagAliasesSnapshot();
  return cached ?? loadTagAliases(window.localStorage);
}

export default function TagAliasesEditor() {
  const aliases = useSyncExternalStore(subscribeTagAliases, getClientSnapshot, getServerSnapshot);

  const [open, setOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string>("");

  const aliasCount = useMemo(() => Object.keys(aliases).length, [aliases]);

  const openEditor = useCallback(() => {
    setRows(rowsFromAliases(aliases));
    setMessage("");
    setOpen(true);
  }, [aliases]);

  const closeEditor = useCallback(() => {
    setOpen(false);
    setRows([]);
    setMessage("");
  }, []);

  const reloadFromLatest = useCallback(() => {
    setRows(rowsFromAliases(getClientSnapshot()));
    setMessage("最新の辞書を読み込みました。");
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [{ id: newRowId(), key: "", value: "" }, ...prev]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<Pick<Row, "key" | "value">>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, ...patch };
      }),
    );
  }, []);

  const save = useCallback(() => {
    if (typeof window === "undefined") return;

    const storage = window.localStorage;
    const next = toAliases(rows);

    // 空保存は「デフォルトに戻す」と同義にしておく（事故りにくい）
    if (Object.keys(next).length === 0) {
      resetTagAliases(storage);
      notifyTagAliasesMutated();
      setMessage("空だったので、デフォルト辞書に戻しました。");
      setOpen(false);
      return;
    }

    saveTagAliases(storage, next);
    notifyTagAliasesMutated();
    setMessage("保存しました。");
    setOpen(false);
  }, [rows]);

  const reset = useCallback(() => {
    if (typeof window === "undefined") return;

    const storage = window.localStorage;
    const next = resetTagAliases(storage);
    notifyTagAliasesMutated();
    setRows(rowsFromAliases(next));
    setMessage("デフォルト辞書に戻しました。");
  }, []);

  return (
    <section className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">タグ辞書（表記ゆれ統一）</div>
          <p className="text-sm opacity-80">
            現在 {aliasCount} 件。保存後は <span className="font-semibold">同一タブでも即反映</span> します。
          </p>
        </div>

        {open ? (
          <button
            type="button"
            onClick={closeEditor}
            className="h-9 rounded-md border px-3 text-sm hover:opacity-80"
          >
            閉じる
          </button>
        ) : (
          <button
            type="button"
            onClick={openEditor}
            className="h-9 rounded-md border px-3 text-sm hover:opacity-80"
          >
            編集
          </button>
        )}
      </div>

      {message ? <p className="mt-2 text-sm opacity-80">{message}</p> : null}

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addRow}
              className="rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
            >
              追加
            </button>
            <button
              type="button"
              onClick={reloadFromLatest}
              className="rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
            >
              最新を読み込む
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
            >
              デフォルトに戻す
            </button>

            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
              >
                保存
              </button>
            </div>
          </div>

          <div className="text-[12px] opacity-80">
            例：<span className="font-semibold">けんこう → 健康</span> /{" "}
            <span className="font-semibold">health → 健康</span>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm opacity-80">
              まだ行がありません。<span className="font-semibold">追加</span> から作れます。
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-md border p-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={r.key}
                      onChange={(e) => updateRow(r.id, { key: e.target.value })}
                      placeholder="エイリアス（例：けんこう / health）"
                      className="rounded-md border bg-transparent px-2 py-1 text-sm"
                    />
                    <input
                      value={r.value}
                      onChange={(e) => updateRow(r.id, { value: e.target.value })}
                      placeholder="統一タグ（例：健康）"
                      className="rounded-md border bg-transparent px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      className="rounded-md border px-3 py-1 text-sm hover:opacity-80"
                    >
                      削除
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] opacity-70">
                    保存時に key は正規化（NFKC/trim/lower/#除去）されます。
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
