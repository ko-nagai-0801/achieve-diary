/* app/history/page.tsx */
import HistoryClientOnly from "./HistoryClientOnly";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HistoryPage() {
  return <HistoryClientOnly />;
}
