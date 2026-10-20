import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-display text-7xl font-bold text-plate-red">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Nothing on this rack</h1>
        <p className="mt-2 text-chalk-muted">That page doesn&apos;t exist, or it was moved.</p>
        <Link href="/log" className="mt-6 inline-block rounded-xl bg-plate-red px-5 py-3 font-display text-lg font-semibold text-white">Back to the app</Link>
      </div>
    </main>
  );
}
