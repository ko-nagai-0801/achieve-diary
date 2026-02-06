/* app/today/TodayClient.tsx */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatJstLong, formatJstYmd } from "@/lib/jst";
import { createId, loadDay, saveDay, type AchieveDay, type AchieveItem, type AchieveMood } from "@/lib/storage";
import { requestDaysRefresh } from "@/lib/days-refresh";
import AddBox from "@/components/today/AddBox";
import TodayList from "@/components/today/TodayList";
import MoodPicker from "@/components/today/MoodPicker";
import MemoBox from "@/components/today/MemoBox";

type SaveState = "idle" | "saved";

function nowIso(): string {
  return new Date().toISOString();
}

export default function TodayClient() {
  const [ymd] = useState<string>(() => formatJstYmd());
  const long = useMemo(() => formatJstLong(), []);

  const [day, setDay] = useState<AchieveDay>(() => loadDay(ymd));

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<number | null>(null);
  const memoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      if (memoTimerRef.current !== null) window.clearTimeout(memoTimerRef.current);
    };
  }, []);

  function flashSaved() {
    setSaveState("saved");
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaveState("idle"), 900);
  }

  function persist(next: AchieveDay) {
    saveDay(next);
    flashSaved();

    // History/Insights 側の共有ストアも idle で追従させる（体感向上）
    requestDaysRefresh({ force: true });
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

  function addItem(text: string): boolean {
    const v = text.trim();
    if (!v) return false;

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
    return true;
  }

  function editItemText(id: string, nextText: string) {
    const v = nextText.trim();
    if (!v) return;

    const next: AchieveDay = {
      ...day,
      items: day.items.map((i) => (i.id === id ? { ...i, text: v } : i)),
    };

    setDay(next);
    persist(next);
  }

  function deleteItem(id: string) {
    const next: AchieveDay = {
      ...day,
      items: day.items.filter((i) => i.id !== id),
    };

    setDay(next);
    persist(next);
  }

  // ===== 気分 / ひとこと =====
  function toggleMood(nextMood: Exclude<AchieveMood, null>) {
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

        <AddBox onAdd={addItem} />

        <TodayList items={day.items} onEditText={editItemText} onDelete={deleteItem} />

        <section className="grid gap-3 md:grid-cols-2">
          <MoodPicker mood={day.mood} onToggle={toggleMood} />
          <MemoBox memo={day.memo} onChange={onMemoChange} />
        </section>
      </section>
    </main>
  );
}
