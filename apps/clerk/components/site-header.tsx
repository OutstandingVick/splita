"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/workspace", label: "Workspace" },
  { href: "/receipts", label: "Receipts" },
] as const;

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-stone-900">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-accent-700 font-mono text-xs text-white">
        S/
      </span>
      Splita
    </Link>
  );
}

export function SiteHeader({ status }: { status?: ReactNode }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const active = path?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 ${active ? "bg-stone-100 font-medium text-stone-900" : "text-stone-600 hover:text-stone-900"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">{status}</div>
      </div>
    </header>
  );
}
