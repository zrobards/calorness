// Shown the instant you tap a tab, while the page's data loads. Shaped like
// the real page so nothing jumps when it arrives.
export function PageSkeleton({ title, blocks = ["h-44", "h-24", "h-24"] }: { title: string; blocks?: string[] }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${title}`}>
      <header className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      </header>
      <div className="space-y-4 px-5">
        {blocks.map((b, i) => (
          <div key={i} className={`skeleton rounded-2xl ${b}`} />
        ))}
      </div>
    </div>
  );
}
