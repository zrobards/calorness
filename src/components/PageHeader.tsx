export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header
      className="flex items-end justify-between px-5 pb-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
    >
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}
