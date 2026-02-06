/* components/today/MemoBox.tsx */
"use client";

type MemoBoxProps = {
  memo: string;
  onChange: (v: string) => void;
};

export default function MemoBox(props: MemoBoxProps) {
  const { memo, onChange } = props;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-semibold text-zinc-200">ひとこと（任意）</h2>

      <textarea
        value={memo}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ひとこと（例：今日はここまでで十分）"
        className="mt-3 h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      />

      <p className="mt-2 text-xs text-zinc-500">※入力は少し待って自動保存されます</p>
    </div>
  );
}
