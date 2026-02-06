/* app/insights/page.tsx */
import InsightsClient from "./InsightsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InsightsPage() {
  return <InsightsClient />;
}
