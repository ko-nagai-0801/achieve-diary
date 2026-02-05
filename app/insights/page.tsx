/* app/insights/page.tsx */
import { formatJstLong, formatJstYmd } from "@/lib/jst";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InsightsPage() {
  const ymd = formatJstYmd();
  const long = formatJstLong();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-400">{ymd}</p>
        <h1 className="text-2xl font-semibold tracking-tight">ふりかえり</h1>
        <p className="text-zinc-300">
          7日間の積み上がりを、数字とことばで見える化します。
        </p>
        <p className="text-sm text-zinc-400">{long}</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { label: "7日合計", value: "0件" },
          { label: "1日平均", value: "0.0件" },
          { label: "一番多い日", value: "—" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <p className="text-xs text-zinc-400">{m.label}</p>
            <p className="mt-2 text-xl font-semibold">{m.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">推移（7日）</h2>
        <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
          グラフは次のステップで追加します（まずは集計ロジックから）。
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-200">よく出るタグ</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["#健康", "#仕事", "#家事", "#学習", "#その他"].map((t) => (
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
        <h2 className="text-sm font-semibold text-zinc-200">
          今週の“できた”言語化
        </h2>
        <p className="mt-3 text-sm text-zinc-300">
          まだデータがありません。1件でも入ると、ここに短い文章が出ます。
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 opacity-60"
            disabled
          >
            コピー
          </button>
        </div>
      </section>
    </section>
  );
}
