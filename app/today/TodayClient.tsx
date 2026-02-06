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
  const [ymd] = useState<string>(() => formatJstYmd());
  const long = useMemo(() => formatJstLong(), []);

  const [day, setDay] = useState<AchieveDay>(() => loadDay(ymd));
  const [text, setText] = useState<string>("");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // ✅ 二重追加防止（Cmd/Ctrl+Enterリピート / 連打対策）
  const addLockRef = useRef<boolean>(false);

  // ✅ 編集状態（複数行）
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  // ✅ 削除確認状態（ワンクリック削除を防ぐ）
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const totalCount = day.items.length;
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
    if (addLockRef.current) return;

    const v = text.trim();
    if (!v) return;

    addLockRef.current = true;

    try {
      const item: AchieveItem = {
        id: createId(),
        text: v,
        // ✅ できたことなので常に true（UIにはチェックは出さない）
        done: true,
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
      setConfirmDeleteId(null);
    } finally {
      window.setTimeout(() => {
        addLockRef.current = false;
      }, 0);
    }
  }

  // ✅ Cmd+Enter / Ctrl+Enter で追加（Enter単体は改行）
  function onAddKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing) return;
    if (e.repeat) return;

    const isShortcut = e.metaKey || e.ctrlKey;
    if (!isShortcut) return;

    e.preventDefault();
    addItem();
  }

  // ===== 編集（保存ルール：Cmd/Ctrl+Enter or 保存ボタンのみ）=====
  function startEdit(item: AchieveItem) {
    setEditingId(item.id);
    setEditText(item.text);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function saveEdit() {
    if (!editingId) return;

    const v = editText.trim();
    if (!v) return;

    const next: AchieveDay = {
      ...day,
      items: day.items.map((i) => (i.id === editingId ? { ...i, text: v } : i)),
    };

    setDay(next);
    persist(next);

    setEditingId(null);
    setEditText("");
  }

  // ✅ 編集時：Enterは改行、Cmd/Ctrl+Enterで保存、Escでキャンセル
  function onEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }

    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing) return;
    if (e.repeat) return;

    const isShortcut = e.metaKey || e.ctrlKey;
    if (!isShortcut) return;

    e.preventDefault();
    saveEdit();
  }

  const editCanSave = editText.trim().length > 0;

  // ===== 削除（確認付き）=====
  function requestDelete(id: string) {
    if (editingId && editingId !== id) {
      cancelEdit();
    }
    setConfirmDeleteId((prev) => (prev === id ? null : id));
  }

  function cancelDelete() {
    setConfirmDeleteId(null);
  }

  function deleteItemNow(id: string) {
    if (editingId === id) {
      setEditingId(null);
      setEditText("");
    }

    const next: AchieveDay = {
      ...day,
      items: day.items.filter((i) => i.id !== id),
    };

    setDay(next);
    persist(next);

    setConfirmDeleteId(null);
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

        <div className="mt-3 space-y-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onAddKeyDown}
            placeholder={
              "できたことを複数行でOK（例：\n・洗い物した\n・5分歩いた #健康）"
            }
            rows={4}
            className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          />

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-zinc-400">
              追加：Macは <span className="font-semibold">⌘ + Enter</span>、Windowsは{" "}
              <span className="font-semibold">Ctrl + Enter</span>（Enterは改行）
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addItem}
                disabled={!canAdd}
                className="shrink-0 whitespace-nowrap rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
              >
                追加
              </button>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            ※MVPでは #タグ を本文に書く方式（例：散歩した #健康）
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">今日のリスト</h2>
          <p className="text-xs text-zinc-400">合計：{totalCount}件</p>
        </div>

        {day.items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
            まだ何もありません。最初の1件を追加してみましょう。
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {day.items.map((item) => {
              const isEditing = editingId === item.id;
              const isConfirmingDelete = confirmDeleteId === item.id;

              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <>
                          <textarea
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={onEditKeyDown}
                            rows={3}
                            className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                          />

                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={saveEdit}
                              disabled={!editCanSave}
                              className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-60"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={cancelEdit}
                              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                            >
                              キャンセル
                            </button>

                            {isConfirmingDelete ? (
                              <>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => deleteItemNow(item.id)}
                                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                                >
                                  本当に削除
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={cancelDelete}
                                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                                >
                                  やめる
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => requestDelete(item.id)}
                                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                              >
                                削除
                              </button>
                            )}

                            <p className="ml-auto text-xs text-zinc-500">
                              ⌘/Ctrl+Enter=保存 / Esc=キャンセル（Enterは改行）
                            </p>
                          </div>

                          {isConfirmingDelete && (
                            <p className="mt-2 text-xs text-zinc-500">
                              ※誤操作防止のため、削除は確認が必要です
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="w-full text-left"
                            aria-label="編集"
                            title="クリックで編集"
                          >
                            <p className="whitespace-pre-wrap break-words text-zinc-100">
                              {item.text}
                            </p>
                          </button>

                          <p className="mt-1 text-xs text-zinc-500">
                            {new Date(item.createdAt).toLocaleString("ja-JP", {
                              timeZone: "Asia/Tokyo",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>

                          {isConfirmingDelete && (
                            <p className="mt-2 text-xs text-zinc-500">
                              ※「本当に削除」を押した場合のみ削除されます
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {isEditing ? null : (
                      <div className="flex flex-col gap-2">
                        {isConfirmingDelete ? (
                          <>
                            <button
                              type="button"
                              onClick={() => deleteItemNow(item.id)}
                              className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                              本当に削除
                            </button>
                            <button
                              type="button"
                              onClick={cancelDelete}
                              className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                              やめる
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(item.id)}
                              className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                            >
                              削除
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
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
