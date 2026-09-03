"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/ricerche", label: "Ricerche" },
  { href: "/liste", label: "Liste" },
  { href: "/logs", label: "Logs" },
  { href: "/impostazioni", label: "Impostazioni" },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-md bg-secondary px-3 py-2.5 text-sm font-semibold text-foreground"
                : "rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
