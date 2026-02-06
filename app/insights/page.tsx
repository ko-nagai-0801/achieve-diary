/* app/insights/page.tsx */
import InsightsClientOnly from "./InsightsClientOnly";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InsightsPage() {
  return <InsightsClientOnly />;
}
