/* app/insights/InsightsClientOnly.tsx */
"use client";

import dynamic from "next/dynamic";

const InsightsClient = dynamic(() => import("./InsightsClient"), { ssr: false });

export default function InsightsClientOnly() {
  return <InsightsClient />;
}
