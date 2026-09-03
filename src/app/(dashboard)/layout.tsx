import { SidebarNav } from "@/components/sidebar-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col justify-between border-r border-border bg-background px-4 py-6">
        <div>
          <div className="flex items-center gap-2.5 px-2 pb-7 pt-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-semibold text-primary-foreground">
                L
              </span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Lead Scraper
            </span>
          </div>
          <SidebarNav />
        </div>
        <div className="flex items-center gap-2.5 border-t border-hairline-soft pl-2 pt-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <span className="text-[13px] font-medium">DD</span>
          </div>
          <div>
            <div className="text-[13px] font-semibold">Dario</div>
            <div className="text-xs text-muted-soft">Uso interno</div>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
