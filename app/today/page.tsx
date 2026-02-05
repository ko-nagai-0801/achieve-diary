/* app/today/page.tsx */
import TodayClient from "./TodayClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TodayPage() {
  return <TodayClient />;
}
