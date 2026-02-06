/* app/today/page.tsx */
import TodayClientOnly from "./TodayClientOnly";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TodayPage() {
  return <TodayClientOnly />;
}
