/* app/today/TodayClient.tsx */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatJstLong, formatJstYmd } from "@/lib/jst";
import {
  createId,
  loadDay,
  saveDay,
  type AchieveDay,
  type AchieveItem,
} from "@/lib/storage";

type SaveState = "idle" | "saved";

function nowIso(): string {
  return new Date().toISOString();
}

export default function TodayClient() {
  // ✅ useRefをrenderで読まない（lint対策）
  const [ymd] = useState<string>(() => formatJstYmd());
  const long = useMemo(() => formatJstLong(), []);

  // ✅ 初期描画で localStorage からロード（ssr:false なのでOK）
  const [day, setDay] = useState<AchieveDay>(() => loadDay(ymd));
  const [text, setText] = useState<string>("");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // unmount時にタイマーだけ掃除（setStateしない）
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const counts = useMemo(() => {
    const total = day.items.length;
    const checked = day.items.filter((i) => i.done).length;
    return { total, checked };
  }, [day.items]);

  const canAdd = text.trim().length > 0;

  function flashSaved() {
    setSaveState("saved");
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("idle");
    }, 900);
  }

  function persist(next: AchieveDay) {
    saveDay(next);
    flashSaved();
  }

  function addItem() {
    const v = text.trim();
    if (!v) return;

    const item: AchieveItem = {
      id: createId(),
      text: v,
      done: false,
      createdAt: nowIso(),
    };

    const next: AchieveDay = {
      ...day,
      items: [item, ...day.items],
    };

    setDay(next);
    persist(next);

    setText("");
    inputRef.current?.focus();
  }

  function toggleDone(id: string) {
    const next: AchieveDay = {
      ...day,
      items: day.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
    };

    setDay(next);
    persist(next);
  }

  function removeItem(id: string) {
    const next: AchieveDay = {
      ...day,
      items: day.items.filter((i) => i.id !== id),
    };

    setDay(next);
    persist(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") addItem();
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-400">{ymd}</p>
        <h1 className="text-2xl font-semibold tracking-tight">今日できたこと</h1>
        <p className="text-zinc-300">小さくてもOK。「できた」を集めましょう。</p>

        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">{long}</p>
          <p className="text-xs text-zinc-500">
            自動保存 {saveState === "saved" ? "✓" : ""}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">追加</h2>

        <div className="mt-3 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="できたことを1行で（例：洗い物した / 5分歩いた）"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!canAdd}
            className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
          >
            追加
          </button>
        </div>

        <p className="mt-2 text-xs text-zinc-400">
          ※MVPでは #タグ を本文に書く方式（例：散歩した #健康）
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">今日のリスト</h2>
          <p className="text-xs text-zinc-400">
            今日：{counts.total}件 / チェック：{counts.checked}件
          </p>
        </div>

        {day.items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            まだ何もありません。最初の1件を追加してみましょう。
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {day.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
              >
                <label className="mt-0.5 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleDone(item.id)}
                    className="h-4 w-4 accent-zinc-200"
                    aria-label="完了"
                  />
                </label>

                <div className="min-w-0 flex-1">
                  <p
                    className={
                      item.done
                        ? "break-words text-zinc-400 line-through"
                        : "break-words text-zinc-100"
                    }
                  >
                    {item.text}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                  aria-label="削除"
                  title="削除"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">気分（任意）</h2>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 opacity-60"
              disabled
            >
              🙂 良い
            </button>
            <button
              type="button"
              className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 opacity-60"
              disabled
            >
              😐 ふつう
            </button>
            <button
              type="button"
              className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 opacity-60"
              disabled
            >
              😣 しんどい
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">ひとこと（任意）</h2>
          <textarea
            placeholder="ひとこと（例：今日はここまでで十分）"
            className="mt-3 h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            disabled
          />
        </div>
      </section>
    </section>
  );
}
