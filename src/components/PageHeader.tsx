import { SearchButton } from "@/components/GlobalSearch";

/** Page title with an app-wide search button; extra buttons go to the right. */
export function PageHeader({ title, children, search = true }: { title: string; children?: React.ReactNode; search?: boolean }) {
  return (
    <header
      className="flex items-end justify-between gap-2 px-5 pb-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <h1 className="min-w-0 truncate font-display text-4xl font-bold tracking-tight">{title}</h1>
      <div className="flex shrink-0 items-center gap-1">
        {search && <SearchButton />}
        {children}
      </div>
    </header>
  );
}
