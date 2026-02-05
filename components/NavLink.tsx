/* components/NavLink.tsx */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  children: ReactNode;
};

export default function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href;

  const base =
    "rounded-full px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400";
  const cls = active
    ? `${base} bg-zinc-100 text-zinc-900`
    : `${base} text-zinc-200 hover:bg-zinc-900 hover:text-zinc-50`;

  return (
    <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
