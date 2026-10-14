import Image from "next/image";
import { Dumbbell } from "lucide-react";

export function ExerciseThumb({ src, size = 44 }: { src: string | null; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-xl bg-chalk"
      style={{ width: size, height: size }}
    >
      {src ? (
        // unoptimized: these are already small JPGs, and skipping Vercel's
        // image optimizer keeps us well inside the free plan's limits
        <Image src={src} alt="" width={size} height={size} unoptimized loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-rack-line text-chalk-muted">
          <Dumbbell size={size * 0.45} aria-hidden />
        </div>
      )}
    </div>
  );
}
