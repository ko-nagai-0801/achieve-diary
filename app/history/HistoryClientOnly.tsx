/* app/history/HistoryClientOnly.tsx */
"use client";

import dynamic from "next/dynamic";

const HistoryClient = dynamic(() => import("./HistoryClient"), { ssr: false });

export default function HistoryClientOnly() {
  return <HistoryClient />;
}
