/* app/today/page.tsx */
import { formatJstLong, formatJstYmd } from "@/lib/jst";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TodayPage() {
  const ymd = formatJstYmd();
  const long = formatJstLong();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-400">{ymd}</p>
        <h1 className="text-2xl font-semibold tracking-tight">今日できたこと</h1>
        <p className="text-zinc-300">
          小さくてもOK。「できた」を集めましょう。
        </p>
        <p className="text-sm text-zinc-400">{long}</p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">追加</h2>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="できたことを1行で（例：洗い物した / 5分歩いた）"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            disabled
          />
          <button
            type="button"
            className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 opacity-60"
            disabled
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
          <p className="text-xs text-zinc-400">今日：0件 / チェック：0件</p>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
          まだ何もありません。最初の1件を追加してみましょう。
        </div>
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
