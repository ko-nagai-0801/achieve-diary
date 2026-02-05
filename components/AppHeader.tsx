/* components/AppHeader.tsx */
import Link from "next/link";
import NavLink from "@/components/NavLink";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/today" className="font-semibold tracking-tight">
          できたこと日記
        </Link>

        <nav className="flex items-center gap-2" aria-label="メインナビゲーション">
          <NavLink href="/today">Today</NavLink>
          <NavLink href="/history">History</NavLink>
          <NavLink href="/insights">Insights</NavLink>
        </nav>
      </div>
    </header>
  );
}
