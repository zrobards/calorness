import Image from "next/image";
import { MuscleFigure } from "@/components/charts/MuscleMap";

/** Exercise photo, or a muscle figure when there's no photo. */
export function ExerciseThumb({ src, muscles = [], size = 44 }: { src: string | null; muscles?: string[]; size?: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-xl bg-chalk" style={{ width: size, height: size }}>
      {src ? (
        // unoptimized: these are already small JPGs, and skipping Vercel's
        // image optimizer keeps us well inside the free plan's limits
        <Image src={src} alt="" width={size} height={size} unoptimized loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-rack-line py-0.5" aria-hidden>
          <MuscleFigure muscles={muscles} />
        </div>
      )}
    </div>
  );
}
