/* components/today/TodayList.tsx */
"use client";

import { useState } from "react";
import type { AchieveItem } from "@/lib/storage";

type TodayListProps = {
  items: AchieveItem[];
  onEditText: (id: string, nextText: string) => void;
  onDelete: (id: string) => void;
};

export default function TodayList(props: TodayListProps) {
  const { items, onEditText, onDelete } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totalCount = items.length;

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

    onEditText(editingId, v);

    setEditingId(null);
    setEditText("");
    setConfirmDeleteId(null);
  }

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

  function requestDelete(id: string) {
    if (editingId && editingId !== id) cancelEdit();
    setConfirmDeleteId((prev) => (prev === id ? null : id));
  }

  function cancelDelete() {
    setConfirmDeleteId(null);
  }

  function deleteItemNow(id: string) {
    onDelete(id);
    setConfirmDeleteId(null);
    if (editingId === id) cancelEdit();
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">今日のリスト</h2>
        <p className="text-xs text-zinc-400">合計：{totalCount}件</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
          まだ何もありません。最初の1件を追加してみましょう。
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => {
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
                          <p className="whitespace-pre-wrap break-words text-zinc-100">{item.text}</p>
                        </button>

                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(item.createdAt).toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
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
  );
}
