/* components/today/MoodPicker.tsx */
"use client";

import type { AchieveMood } from "@/lib/storage";

type MoodPickerProps = {
  mood: AchieveMood;
  onToggle: (m: Exclude<AchieveMood, null>) => void;
};

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

export default function MoodPicker(props: MoodPickerProps) {
  const { mood, onToggle } = props;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-semibold text-zinc-200">気分（任意）</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["good", "neutral", "tough"] as const).map((m) => {
          const selected = mood === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onToggle(m)}
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

      <p className="mt-2 text-xs text-zinc-500">※同じボタンをもう一度押すと「未設定」に戻ります</p>
    </div>
  );
}
