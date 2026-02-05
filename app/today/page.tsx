/* app/today/page.tsx */
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TodayClient = nextDynamic(() => import("./TodayClient"), { ssr: false });

export default function TodayPage() {
  return <TodayClient />;
}
