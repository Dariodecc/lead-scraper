export default function ListePage() {
  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">
          Liste
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura i campi di una lista, poi collegala a una o più ricerche
        </p>
      </div>
      <button className="mb-5 h-10 rounded-md bg-primary px-4.5 text-sm font-semibold text-primary-foreground">
        + Nuova lista
      </button>
      <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
        Nessuna lista ancora — creane una, oppure eseguine una da un TEST in
        Ricerche.
      </div>
    </div>
  );
}
