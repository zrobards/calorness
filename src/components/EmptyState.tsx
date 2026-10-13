import type { LucideIcon } from "lucide-react";

export function EmptyState({
  Icon,
  title,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-5 rounded-2xl border border-dashed border-rack-line px-6 py-10 text-center">
      <Icon className="mx-auto mb-3 text-chalk-muted" size={32} aria-hidden />
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-chalk-muted">{children}</p>
    </div>
  );
}
