/* app/history/page.tsx */
import { formatJstLong, formatJstYmd } from "@/lib/jst";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HistoryPage() {
  const ymd = formatJstYmd();
  const long = formatJstLong();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-400">{ymd}</p>
        <h1 className="text-2xl font-semibold tracking-tight">履歴</h1>
        <p className="text-zinc-300">
          過去の「できたこと」を検索・見返せます。
        </p>
        <p className="text-sm text-zinc-400">{long}</p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">検索</h2>
        <input
          type="text"
          placeholder="検索（例：#健康 / 散歩 / 片付け）"
          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          disabled
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {["#仕事", "#健康", "#家事", "#学習"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">日付一覧</h2>
        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
          まだ履歴がありません。/today で追加すると、ここに並びます。
        </div>
      </section>
    </section>
  );
}
