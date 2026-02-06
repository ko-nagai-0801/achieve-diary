/* app/today/TodayClient.tsx */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatJstLong, formatJstYmd } from "@/lib/jst";
import {
  createId,
  loadDay,
  saveDay,
  scanDaysFromStorage,
  type AchieveDay,
  type AchieveItem,
  type AchieveMood,
  type DayEntry,
} from "@/lib/storage";
import {
  extractTags,
  loadTagAliases,
  normalizeAliasKey,
  type TagAliases,
} from "@/lib/diary";

type SaveState = "idle" | "saved";

function nowIso(): string {
  return new Date().toISOString();
}

type TagSuggestion = {
  tag: string; // canonical tag
  totalCount: number;
  recent7Count: number;
  lastSeenYmd: string; // YYYY-MM-DD
  matchKeys: string[]; // canonical + alias keys (normalized)
};

const TAG_SUGGEST_SPACE_KEY = "achieve:tag-suggest:space:v1";

function jstYmdFromDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function lastNYmds(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(jstYmdFromDate(x));
  }
  return out;
}

function invertAliases(aliases: TagAliases): Map<string, string[]> {
  const inv = new Map<string, string[]>();
  for (const [k, v] of Object.entries(aliases)) {
    const canon = v.normalize("NFKC").trim();
    if (!canon) continue;
    const arr = inv.get(canon) ?? [];
    arr.push(k);
    inv.set(canon, arr);
  }
  return inv;
}

function buildTagSuggestions(entries: DayEntry[], aliases: TagAliases): TagSuggestion[] {
  const inv = invertAliases(aliases);
  const recentSet = new Set<string>(lastNYmds(7));

  const stat = new Map<string, { total: number; recent7: number; lastSeen: string }>();

  for (const e of entries) {
    const isRecent7 = recentSet.has(e.ymd);

    for (const it of e.day.items) {
      const tags = extractTags(it.text, aliases);
      for (const t of tags) {
        const cur = stat.get(t) ?? { total: 0, recent7: 0, lastSeen: "" };
        cur.total += 1;
        if (isRecent7) cur.recent7 += 1;
        if (!cur.lastSeen || e.ymd > cur.lastSeen) cur.lastSeen = e.ymd;
        stat.set(t, cur);
      }
    }
  }

  const arr: TagSuggestion[] = Array.from(stat.entries()).map(([tag, s]) => ({
    tag,
    totalCount: s.total,
    recent7Count: s.recent7,
    lastSeenYmd: s.lastSeen,
    matchKeys: [tag.normalize("NFKC").trim().toLowerCase(), ...(inv.get(tag) ?? [])],
  }));

  arr.sort((a, b) => {
    const ar = a.recent7Count > 0 ? 1 : 0;
    const br = b.recent7Count > 0 ? 1 : 0;
    if (br !== ar) return br - ar;
    if (b.recent7Count !== a.recent7Count) return b.recent7Count - a.recent7Count;
    if (b.lastSeenYmd !== a.lastSeenYmd) return b.lastSeenYmd.localeCompare(a.lastSeenYmd);
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return a.tag.localeCompare(b.tag);
  });

  return arr;
}

function getActiveTagToken(
  text: string,
  cursor: number,
): { hashIndex: number; token: string } | null {
  const before = text.slice(0, cursor);
  const hashIndex = before.lastIndexOf("#");
  if (hashIndex === -1) return null;

  if (hashIndex > 0) {
    const prev = before[hashIndex - 1] ?? "";
    if (!/\s/.test(prev)) return null;
  }

  const afterHash = before.slice(hashIndex + 1);
  if (/\s/.test(afterHash)) return null;

  return { hashIndex, token: afterHash };
}

function loadBool(storage: Storage, key: string, defaultValue: boolean): boolean {
  const raw = storage.getItem(key);
  if (!raw) return defaultValue;
  if (raw === "1") return true;
  if (raw === "0") return false;
  return defaultValue;
}

function saveBool(storage: Storage, key: string, value: boolean): void {
  storage.setItem(key, value ? "1" : "0");
}

function moodLabel(m: Exclude<AchieveMood, null>): string {
  switch (m) {
    case "good":
      return "🙂 良い";
    case "neutral":
      return "😐 ふつう";
    case "tough":
      return "😣 しんどい";
  }
}

export default function TodayClient() {
  const [ymd] = useState<string>(() => formatJstYmd());
  const long = useMemo(() => formatJstLong(), []);

  const [day, setDay] = useState<AchieveDay>(() => loadDay(ymd));
  const [text, setText] = useState<string>("");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const caretRef = useRef<number>(0);

  const addLockRef = useRef<boolean>(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ===== タグ候補データ =====
  const [aliases, setAliases] = useState<TagAliases>(() => {
    if (typeof window === "undefined") return {};
    return loadTagAliases(window.localStorage);
  });

  const [entries, setEntries] = useState<DayEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return scanDaysFromStorage(window.localStorage);
  });

  const refreshTagData = useCallback(() => {
    setAliases(loadTagAliases(window.localStorage));
    setEntries(scanDaysFromStorage(window.localStorage));
  }, []);

  // ===== オプション：選択後に半角スペースを自動挿入 =====
  const [autoSpace, setAutoSpace] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return loadBool(window.localStorage, TAG_SUGGEST_SPACE_KEY, true);
  });

  function toggleAutoSpace(next: boolean) {
    setAutoSpace(next);
    saveBool(window.localStorage, TAG_SUGGEST_SPACE_KEY, next);
  }

  const [focused, setFocused] = useState<boolean>(false);
  const [suggestEnabled, setSuggestEnabled] = useState<boolean>(true);

  const memoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onFocus = () => refreshTagData();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshTagData();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);

      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      if (memoTimerRef.current !== null) window.clearTimeout(memoTimerRef.current);
    };
  }, [refreshTagData]);

  const allSuggestions = useMemo(() => buildTagSuggestions(entries, aliases), [entries, aliases]);

  const activeTag = useMemo(() => {
    const cursor = caretRef.current;
    return getActiveTagToken(text, cursor);
  }, [text]);

  const shouldShowSuggest = focused && suggestEnabled && activeTag !== null;

  const filteredSuggestions = useMemo(() => {
    if (!shouldShowSuggest) return [];

    const tokenNorm = normalizeAliasKey(activeTag?.token ?? "");
    if (!tokenNorm) return allSuggestions.slice(0, 10);

    return allSuggestions
      .filter((s) => s.matchKeys.some((k) => k.includes(tokenNorm)))
      .slice(0, 10);
  }, [shouldShowSuggest, activeTag, allSuggestions]);

  function flashSaved() {
    setSaveState("saved");
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaveState("idle"), 900);
  }

  function persist(next: AchieveDay) {
    saveDay(next);
    flashSaved();
  }

  // ✅ storage側の最新を読み直して items を守りつつマージ（空items上書き防止）
  function mergeWithStored(partial: Partial<AchieveDay>): AchieveDay {
    const stored = loadDay(ymd);
    const base = stored.items.length >= day.items.length ? stored : day;

    return {
      ymd,
      items: base.items,
      mood: base.mood ?? null,
      memo: typeof base.memo === "string" ? base.memo : "",
      updatedAt: base.updatedAt,
      ...partial,
    };
  }

  function insertTag(tag: string) {
    const el = inputRef.current;
    if (!el) return;

    const cursor = caretRef.current;
    const active = getActiveTagToken(text, cursor);
    if (!active) return;

    const { hashIndex } = active;

    let end = cursor;
    while (end < text.length && !/\s/.test(text[end] ?? "")) end++;

    const before = text.slice(0, hashIndex);
    const after = text.slice(end);

    let inserted = `#${tag}`;
    if (autoSpace) {
      const nextChar = after[0] ?? "";
      const needSpace = after.length === 0 || (nextChar !== "" && !/\s/.test(nextChar));
      if (needSpace) inserted += " ";
    }

    const nextText = `${before}${inserted}${after}`;
    const nextCursor = (before + inserted).length;

    setText(nextText);
    setSuggestEnabled(false);

    window.setTimeout(() => {
      const el2 = inputRef.current;
      if (!el2) return;
      el2.focus();
      el2.setSelectionRange(nextCursor, nextCursor);
      caretRef.current = nextCursor;
    }, 0);
  }

  const totalCount = day.items.length;
  const canAdd = text.trim().length > 0;

  function addItem() {
    if (addLockRef.current) return;

    const v = text.trim();
    if (!v) return;

    addLockRef.current = true;

    try {
      const item: AchieveItem = {
        id: createId(),
        text: v,
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
      caretRef.current = 0;
      inputRef.current?.focus();

      setConfirmDeleteId(null);
      refreshTagData();
    } finally {
      window.setTimeout(() => {
        addLockRef.current = false;
      }, 0);
    }
  }

  function onAddKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.nativeEvent.isComposing) return;
    if (e.repeat) return;

    const isShortcut = e.metaKey || e.ctrlKey;
    if (!isShortcut) return;

    e.preventDefault();
    addItem();
  }

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
    refreshTagData();
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
    refreshTagData();
  }

  // ===== 気分 / ひとこと =====
  function setMood(nextMood: Exclude<AchieveMood, null>) {
    const mood: AchieveMood = day.mood === nextMood ? null : nextMood;
    const merged = mergeWithStored({ mood });
    setDay(merged);
    persist(merged);
  }

  function onMemoChange(v: string) {
    const merged = mergeWithStored({ memo: v });
    setDay(merged);

    if (memoTimerRef.current !== null) window.clearTimeout(memoTimerRef.current);
    memoTimerRef.current = window.setTimeout(() => {
      const again = mergeWithStored({ memo: v });
      persist(again);
    }, 350);
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-zinc-400">{ymd}</p>
          <h1 className="text-2xl font-semibold tracking-tight">今日できたこと</h1>
          <p className="text-zinc-300">小さくてもOK。「できた」を集めましょう。</p>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">{long}</p>
            <p className="text-xs text-zinc-500">自動保存 {saveState === "saved" ? "✓" : ""}</p>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">追加</h2>

          <div className="mt-3 space-y-2">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  const v = e.target.value;
                  setText(v);
                  caretRef.current = e.target.selectionStart ?? v.length;
                  setSuggestEnabled(true);
                }}
                onKeyDown={(e) => {
                  const el = e.currentTarget;
                  caretRef.current = el.selectionStart ?? el.value.length;
                  setSuggestEnabled(true);
                  onAddKeyDown(e);
                }}
                onClick={(e) => {
                  const el = e.currentTarget;
                  caretRef.current = el.selectionStart ?? el.value.length;
                  setSuggestEnabled(true);
                }}
                onKeyUp={(e) => {
                  const el = e.currentTarget;
                  caretRef.current = el.selectionStart ?? el.value.length;
                }}
                onFocus={() => {
                  setFocused(true);
                  setSuggestEnabled(true);
                  refreshTagData();
                }}
                onBlur={() => setFocused(false)}
                placeholder={"できたことを複数行でOK（例：\n・洗い物した\n・5分歩いた #健康）"}
                rows={4}
                className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              />

              {shouldShowSuggest && filteredSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-lg">
                  <div className="flex items-center justify-between px-2 pb-1">
                    <div>
                      <p className="text-xs text-zinc-500">タグ候補（直近7日優先）</p>
                      <p className="text-[11px] text-zinc-500">
                        ヒント：<span className="font-semibold">#</span>の後に入力すると絞り込み
                      </p>
                    </div>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => refreshTagData()}
                      className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
                    >
                      更新
                    </button>
                  </div>

                  <ul className="flex flex-wrap gap-2 px-2 pb-1">
                    {filteredSuggestions.map((s) => (
                      <li key={s.tag}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertTag(s.tag)}
                          className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-900"
                          title="挿入"
                        >
                          <span>#{s.tag}</span>{" "}
                          <span className="text-xs text-zinc-400">
                            7日×{s.recent7Count} / 全体×{s.totalCount}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between gap-2 px-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-zinc-200">
                      <input
                        type="checkbox"
                        checked={autoSpace}
                        onChange={(e) => toggleAutoSpace(e.target.checked)}
                        className="h-4 w-4 accent-zinc-200"
                      />
                      候補クリック後に半角スペースを自動挿入
                    </label>

                    <span className="text-[11px] text-zinc-500">ON/OFFは保存されます</span>
                  </div>
                </div>
              ) : null}
            </div>

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

            <p className="text-xs text-zinc-400">※MVPでは #タグ を本文に書く方式（例：散歩した #健康）</p>
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

            <div className="mt-3 flex flex-wrap gap-2">
              {(["good", "neutral", "tough"] as const).map((m) => {
                const selected = day.mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={[
                      "rounded-xl border px-3 py-2 text-sm",
                      selected
                        ? "border-zinc-200 bg-zinc-200 text-zinc-900"
                        : "border-zinc-800 text-zinc-200 hover:bg-zinc-900",
                    ].join(" ")}
                    aria-pressed={selected}
                    title={selected ? "もう一度押すと解除" : "選択"}
                  >
                    {moodLabel(m)}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              ※同じボタンをもう一度押すと「未設定」に戻ります
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-sm font-semibold text-zinc-200">ひとこと（任意）</h2>

            <textarea
              value={day.memo}
              onChange={(e) => onMemoChange(e.target.value)}
              placeholder="ひとこと（例：今日はここまでで十分）"
              className="mt-3 h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />

            <p className="mt-2 text-xs text-zinc-500">※入力は少し待って自動保存されます</p>
          </div>
        </section>
      </section>
    </main>
  );
}
