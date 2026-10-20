import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

// Plain-language summary of what the app does with your data. Not legal
// advice; if Calorness ever charges money, have this reviewed properly.
const SECTIONS = [
  {
    title: "What Calorness stores",
    body: "Your name, email, and password (only as a secure scrambled hash, never the password itself). The workouts, foods, water, weigh-ins, and goals you log. Your phone's time zone, so your days line up.",
  },
  {
    title: "Meal photos and AI",
    body: "When you snap a meal, describe one, or scan a label, the photo or text is sent to Anthropic's Claude AI to estimate nutrition. Calorness doesn't keep the photo. Anthropic's API doesn't use it to train its models.",
  },
  {
    title: "Food databases",
    body: "Food searches and barcodes are looked up in USDA FoodData Central and Open Food Facts. Only the search words or barcode number are sent, never your account details. Foods you add by scanning a Nutrition Facts label are shared with other Calorness users (just the food's name, brand, and numbers, never who scanned it or when you ate it) so everyone's search gets more accurate. Foods you type in by hand stay private, unless several different people enter the same food with matching numbers; then a shared \"community\" version is made from the typical values (again, just the food and its numbers). When you correct an AI estimate, how far off it was for that kind of food is pooled anonymously to make future estimates better for everyone.",
  },
  {
    title: "Who can see your data",
    body: "Your account is private to you. Calorness is a personal project run by Zach RoBards, who manages the database and could technically view it, and won't sell, share, or advertise with it. The shared demo account is visible to everyone who uses it, so don't log real data there.",
  },
  {
    title: "Notifications and shortcuts",
    body: "Notifications only happen if you turn them on, and can be turned off in Profile. Shortcut keys are stored scrambled and can be deleted in Profile any time.",
  },
  {
    title: "Deleting everything",
    body: "Profile → Delete my account removes your account and everything you've logged, permanently.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-md px-6 pb-12" style={{ paddingTop: "calc(env(safe-area-inset-top) + 2rem)" }}>
      <Link href="/" className="font-display text-xl font-semibold text-chalk-muted">Calorness</Link>
      <h1 className="mt-8 font-display text-5xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-3 text-chalk-muted">The short version: your data is yours, it&apos;s not sold, and you can delete it any time.</p>
      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
            <p className="mt-1 leading-relaxed text-chalk/90">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
