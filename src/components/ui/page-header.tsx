import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";

type Back = { label: string; href: string } | { label: string; onClick: () => void };

const backClass =
  "mb-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground";

/** Intestazione di pagina: titolo, descrizione (max 65ch), azioni a destra, "indietro" opzionale. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: Back;
}) {
  return (
    <div className="rise mb-7">
      {back &&
        ("href" in back ? (
          <Link href={back.href} className={backClass}>
            <ArrowLeft size={14} weight="bold" aria-hidden />
            {back.label}
          </Link>
        ) : (
          <button type="button" onClick={back.onClick} className={backClass}>
            <ArrowLeft size={14} weight="bold" aria-hidden />
            {back.label}
          </button>
        ))}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
          {description && <p className="mt-1.5 max-w-[65ch] text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
