/* app/history/page.tsx */
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HistoryClient = nextDynamic(() => import("./HistoryClient"), {
  ssr: false,
});

export default function HistoryPage() {
  return <HistoryClient />;
}
