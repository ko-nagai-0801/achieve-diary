/* app/today/TodayClientOnly.tsx */
"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type Props = Record<string, never>;

type TodayModule = {
  default?: ComponentType<Props>;
  TodayClient?: ComponentType<Props>;
};

const TodayClient = dynamic<Props>(
  async () => {
    const mod = (await import("./TodayClient")) as unknown as TodayModule;
    const Comp = mod.default ?? mod.TodayClient;

    if (!Comp) {
      // export が想定外だった場合の保険（画面を壊さない）
      return function Missing() {
        return (
          <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
            <p className="text-sm text-zinc-400">TodayClient export not found.</p>
          </main>
        );
      };
    }

    return Comp;
  },
  {
    ssr: false,
    loading: () => (
      <main className="mx-auto w-full max-w-3xl p-4 md:p-6">
        <p className="text-sm text-zinc-400">Loading...</p>
      </main>
    ),
  },
);

export default function TodayClientOnly() {
  return <TodayClient />;
}
