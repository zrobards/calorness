import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";

const PLATES = [
  { label: "Calories", color: "bg-plate-red", size: "size-20" },
  { label: "Protein", color: "bg-plate-blue", size: "size-17" },
  { label: "Carbs", color: "bg-plate-yellow", size: "size-14" },
  { label: "Fat", color: "bg-plate-green", size: "size-11" },
];

export default function LandingPage() {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col px-6"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 3rem)", paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
    >
      {/* Signed-in visitors skip straight to the app */}
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <p className="font-display text-xl font-semibold text-chalk-muted">Calorness</p>

      <h1 className="animate-rise mt-10 font-display text-6xl leading-[0.95] font-bold tracking-tight">
        Log the lift.
        <br />
        Log the plate.
      </h1>
      <p className="mt-5 max-w-sm text-lg text-chalk-muted">
        Workouts and nutrition in one app, so your training and your eating finally
        work from the same numbers.
      </p>

      {/* Plates loaded on a bar, heaviest closest to the center */}
      <div className="mt-12 flex items-center" aria-hidden>
        <div className="h-3 w-10 rounded-l-full bg-chalk-muted" />
        {PLATES.map((p, i) => (
          <div key={p.label} className={`animate-plate-on ${p.size} ${p.color} -mx-0.5 rounded-full border-4 border-rack`} style={{ "--i": i } as React.CSSProperties} />
        ))}
        <div className="h-3 flex-1 rounded-r-full bg-chalk-muted" />
      </div>
      <ul className="mt-4 flex gap-4 text-sm text-chalk-muted">
        {PLATES.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${p.color}`} />
            {p.label}
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3 pt-12">
        <Link
          href="/signin"
          className="block rounded-xl bg-plate-red py-3.5 text-center font-display text-xl font-semibold text-white"
        >
          Get started
        </Link>
        <p className="text-center text-sm text-chalk-muted">
          Built by Zach RoBards.{" "}
          <a href="https://github.com/zrobards/calorness" className="underline underline-offset-4">
            View the code
          </a>
        </p>
      </div>
    </main>
  );
}

async function RedirectIfSignedIn() {
  if (await getOptionalUser()) redirect("/train");
  return null;
}
