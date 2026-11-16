"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crosshair,
  GearSix,
  List,
  ListBullets,
  MagnifyingGlass,
  MapTrifold,
  Pulse,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/ricerche", label: "Ricerche", icon: MagnifyingGlass },
  { href: "/mappa", label: "Mappa", icon: MapTrifold },
  { href: "/liste", label: "Liste", icon: ListBullets },
  { href: "/logs", label: "Logs", icon: Pulse },
];

const SETTINGS: NavItem = { href: "/impostazioni", label: "Impostazioni", icon: GearSix };

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.2)]">
        <Crosshair size={18} weight="bold" aria-hidden />
      </div>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">Lead Scraper</span>
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const active = pathname?.startsWith(item.href) ?? false;
  const IconCmp = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <IconCmp
        size={18}
        weight={active ? "fill" : "regular"}
        aria-hidden
        className={cn("transition-colors", active ? "text-brand" : "text-muted-soft group-hover:text-foreground")}
      />
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="pb-6 pt-1">
          <Brand />
        </div>
        <nav aria-label="Principale" className="grid gap-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
      </div>
      <div className="grid gap-3">
        <NavLink item={SETTINGS} pathname={pathname} />
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3.5">
          <div className="flex min-w-0 items-center gap-2.5 pl-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
              DD
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium">Dario</div>
              <div className="truncate text-xs text-muted-soft">Uso interno</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chiude il menu mobile al cambio pagina
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      <a
        href="#contenuto"
        className="sr-only z-[200] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Vai al contenuto
      </a>

      {/* Barra superiore: solo sotto i 1024px */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Apri il menu"
          className="flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        >
          <List size={20} weight="bold" />
        </button>
      </header>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} width={288} side="left">
        <div className="h-full bg-sidebar px-4 py-5">
          <SidebarContent pathname={pathname} />
        </div>
      </Drawer>

      {/* Sidebar fissa: da 1024px in su */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-sidebar-border bg-sidebar px-3.5 py-5 lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      <main id="contenuto" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1360px] px-4 pb-20 pt-6 sm:px-8 lg:px-10 lg:pt-10">{children}</div>
      </main>
    </div>
  );
}
