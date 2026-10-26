import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoalForm } from "./GoalForm";
import { TargetsEditor } from "./TargetsEditor";
import { SetPasswordForm } from "./SetPasswordForm";
import { ShortcutKeys } from "./ShortcutKeys";
import { NotificationsCard } from "./NotificationsCard";
import { InviteCard } from "./InviteCard";
import { BodyStatsCard } from "./BodyStatsCard";
import { ActivityGoals, HealthSetup, WidgetSetup } from "./ActivitySetup";
import { DeleteAccount } from "./DeleteAccount";
import Link from "next/link";
import QRCode from "qrcode";
import { aiLimitFor, aiUsedToday } from "@/lib/aiLimit";
import { setUnitSystem } from "./actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: {
      goal: true,
      apiKeys: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true } },
    },
  });

  const siteUrl = (process.env.NEXTAUTH_URL ?? "https://calorness.vercel.app").replace(/\/$/, "");
  const [qrSvg, aiUsed, aiLimit] = await Promise.all([
    QRCode.toString(siteUrl, { type: "svg", margin: 0, color: { dark: "#17212b", light: "#ffffff" } }),
    aiUsedToday(user.id),
    aiLimitFor(user.id),
  ]);

  return (
    <>
      <PageHeader title="Profile">
        <SignOutButton />
      </PageHeader>

      <section className="mx-5 rounded-2xl bg-rack-raised p-5">
        <p className="font-display text-2xl font-semibold">{user.name ?? "Lifter"}</p>
        {user.email && <p className="text-chalk-muted">{user.email}</p>}

        <form action={setUnitSystem} className="mt-4 flex gap-2" aria-label="Units">
          {(["IMPERIAL", "METRIC"] as const).map((u) => (
            <button
              key={u}
              name="unitSystem"
              value={u}
              aria-pressed={user.unitSystem === u}
              className={`flex-1 rounded-xl border py-2 text-sm font-medium ${
                user.unitSystem === u
                  ? "border-plate-yellow text-chalk"
                  : "border-rack-line text-chalk-muted"
              }`}
            >
              {u === "IMPERIAL" ? "Pounds, feet" : "Kilograms, cm"}
            </button>
          ))}
        </form>
        <SetPasswordForm hasPassword={!!user.passwordHash} email={user.email} />
      </section>

      <section id="goals" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Daily targets</h2>
        {user.goal ? (
          <>
            <p className="mt-1 text-sm text-chalk-muted">Set by the calculator. Change any number to make it yours.</p>
            <TargetsEditor
              waterUnit={user.unitSystem === "IMPERIAL" ? "fl oz" : "ml"}
              initial={{
                calories: user.goal.calories,
                proteinG: user.goal.proteinG,
                carbsG: user.goal.carbsG,
                fatG: user.goal.fatG,
                water: Math.round(user.unitSystem === "IMPERIAL" ? user.goal.waterMl / 29.5735 : user.goal.waterMl),
              }}
            />
            <details className="mt-5 border-t border-rack-line pt-4">
              <summary className="cursor-pointer font-medium text-plate-blue">Recalculate from my stats</summary>
              <div className="mt-4">
                <GoalForm unitSystem={user.unitSystem} />
              </div>
            </details>
          </>
        ) : (
          <>
            <p className="mt-1 text-chalk-muted">
              Answer a few questions and Calorness will estimate your calories and macros. You can fine-tune them after.
            </p>
            <div className="mt-5">
              <GoalForm unitSystem={user.unitSystem} />
            </div>
          </>
        )}
      </section>
      <section id="activity-goals" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Activity goals</h2>
        <ActivityGoals initial={{ stepGoal: user.stepGoal, activeCalGoal: user.activeCalGoal, exerciseMinGoal: user.exerciseMinGoal, useHealthCalories: user.useHealthCalories }} />
      </section>

      <section id="health" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Apple Health</h2>
        <HealthSetup origin={siteUrl} shortcutUrl={process.env.HEALTH_SHORTCUT_URL ?? null} />
      </section>

      <section id="widget" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Home-screen widget</h2>
        <WidgetSetup origin={siteUrl} />
      </section>

      <section id="body" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Body stats</h2>
        <BodyStatsCard
          imperial={user.unitSystem === "IMPERIAL"}
          initial={{ sex: user.sex, age: user.birthYear ? new Date().getFullYear() - user.birthYear : null, heightCm: user.heightCm }}
          credit={user.exerciseCredit}
        />
      </section>

      <section id="invite" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Invite friends</h2>
        <InviteCard url={siteUrl} qrSvg={qrSvg} />
      </section>

      <section id="notifications" className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Notifications</h2>
        <NotificationsCard />
      </section>

      <section id="shortcut" className="animate-rise mx-5 mt-4 mb-6 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Phone shortcut</h2>
        <ShortcutKeys
          keys={user.apiKeys.map((k) => ({
            ...k,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </section>
      <section className="mx-5 mb-8 space-y-4 px-1 text-sm text-chalk-muted">
        <p>
          AI requests today: {aiUsed}
          {Number.isFinite(aiLimit) ? ` of ${aiLimit}` : " (no limit for the app owner)"}. Barcode, search, and saved meals don&apos;t count.
        </p>
        <p><Link href="/privacy" className="underline underline-offset-4">Privacy: what Calorness stores and shares</Link></p>
        <DeleteAccount />
      </section>
    </>
  );
}
