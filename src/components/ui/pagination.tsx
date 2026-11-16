import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  total,
  noun,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  /** Sostantivo plurale per il conteggio, es. "risultati". */
  noun: string;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Paginazione" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
      <span className="num">
        {total.toLocaleString("it-IT")} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>
          <CaretLeft weight="bold" aria-hidden />
          Precedente
        </Button>
        <span className="num min-w-24 text-center">
          Pagina {page} di {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>
          Successiva
          <CaretRight weight="bold" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
