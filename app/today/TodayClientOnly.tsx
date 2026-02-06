/* app/today/TodayClientOnly.tsx */
"use client";

import dynamic from "next/dynamic";

const TodayClient = dynamic(() => import("./TodayClient"), { ssr: false });

export default function TodayClientOnly() {
  return <TodayClient />;
}
