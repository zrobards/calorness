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
import { Collapsible, SearchableSections } from "@/components/ui/Collapsible";
import { Bell, HeartPulse, KeyRound, LayoutGrid, Ruler, Shield, Target, UserRound, Users } from "lucide-react";
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
  const [qrSvg, aiUsed, aiLimit, lastHealth] = await Promise.all([
    QRCode.toString(siteUrl, { type: "svg", margin: 0, color: { dark: "#17212b", light: "#ffffff" } }),
    aiUsedToday(user.id),
    aiLimitFor(user.id),
    db.dailyActivity.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, steps: true, date: true } }),
  ]);
  const imperial = user.unitSystem === "IMPERIAL";
  const age = user.birthYear ? new Date().getFullYear() - user.birthYear : null;
  const height = user.heightCm ? (imperial ? `${Math.floor(user.heightCm / 2.54 / 12)}′${Math.round((user.heightCm / 2.54) % 12)}″` : `${Math.round(user.heightCm)} cm`) : null;

  // Every setting lives in a section that opens when you need it, so the
  // page stays short; the search box finds any of them by name.
  return (
    <>
      <PageHeader title="Profile">
        <SignOutButton />
      </PageHeader>

      <div className="mx-5 mb-3">
        <p className="font-display text-2xl font-semibold">{user.name ?? "Lifter"}</p>
        {user.email && <p className="text-sm text-chalk-muted">{user.email}</p>}
      </div>

      <SearchableSections placeholder="Search settings">
        <Collapsible id="goals" title="Daily targets" icon={<Target size={20} />} defaultOpen={!user.goal}
          summary={user.goal ? `${user.goal.calories.toLocaleString("en-US")} cal, ${user.goal.proteinG} g protein, ${user.goal.carbsG} g carbs, ${user.goal.fatG} g fat` : "Not set yet"}
          keywords="calories macros protein carbs fat water goal calculator tdee bmr">
          {user.goal ? (
            <>
              <p className="mt-3 text-sm text-chalk-muted">Change any number to make it yours.</p>
              <TargetsEditor
                waterUnit={imperial ? "fl oz" : "ml"}
                initial={{
                  calories: user.goal.calories,
                  proteinG: user.goal.proteinG,
                  carbsG: user.goal.carbsG,
                  fatG: user.goal.fatG,
                  water: Math.round(imperial ? user.goal.waterMl / 29.5735 : user.goal.waterMl),
                }}
              />
              <details className="mt-5 border-t border-rack-line pt-4">
                <summary className="cursor-pointer font-medium text-plate-blue">Recalculate from my stats</summary>
                <div className="mt-4"><GoalForm unitSystem={user.unitSystem} /></div>
              </details>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-chalk-muted">Answer a few questions and Calorness estimates your calories and macros. You can fine-tune them after.</p>
              <div className="mt-4"><GoalForm unitSystem={user.unitSystem} /></div>
            </>
          )}
        </Collapsible>

        <Collapsible id="body" title="Body stats" icon={<Ruler size={20} />}
          summary={[user.sex ? (user.sex === "male" ? "Male" : "Female") : null, age ? `${age} years` : null, height].filter(Boolean).join(", ") || "Add for accurate calorie burn"}
          keywords="sex age height weight exercise credit calories burned">
          <BodyStatsCard imperial={imperial} initial={{ sex: user.sex, age, heightCm: user.heightCm }} credit={user.exerciseCredit} />
        </Collapsible>

        <Collapsible id="activity-goals" title="Activity goals" icon={<LayoutGrid size={20} />}
          summary={`${user.stepGoal.toLocaleString("en-US")} steps, ${user.activeCalGoal} move cal, ${user.exerciseMinGoal} exercise min`}
          keywords="steps move active calories exercise minutes rings">
          <ActivityGoals initial={{ stepGoal: user.stepGoal, activeCalGoal: user.activeCalGoal, exerciseMinGoal: user.exerciseMinGoal, useHealthCalories: user.useHealthCalories }} />
        </Collapsible>

        <Collapsible id="health" title="Apple Health" icon={<HeartPulse size={20} />}
          summary={lastHealth ? `Connected, last sync ${lastHealth.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not connected. Tap to set up in a few minutes"}
          keywords="apple health watch steps active energy sync connect shortcut health auto export walking speed">
          <HealthSetup origin={siteUrl} shortcutUrl={process.env.HEALTH_SHORTCUT_URL ?? null}
            initialStatus={lastHealth ? { lastSync: lastHealth.updatedAt.toISOString(), steps: lastHealth.steps, day: lastHealth.date.toISOString().slice(0, 10) } : null} />
        </Collapsible>

        <Collapsible id="widget" title="Home-screen widget" icon={<LayoutGrid size={20} />} summary="Calories left, steps, and streak on your home screen"
          keywords="widget scriptable home screen">
          <WidgetSetup origin={siteUrl} />
        </Collapsible>

        <Collapsible id="notifications" title="Notifications" icon={<Bell size={20} />} summary="Rest timer and daily reminders" keywords="push alerts reminders rest timer">
          <NotificationsCard />
        </Collapsible>

        <Collapsible id="shortcut" title="Phone shortcut keys" icon={<KeyRound size={20} />}
          summary={user.apiKeys.length ? `${user.apiKeys.length} key${user.apiKeys.length === 1 ? "" : "s"}` : "Log food from an iPhone shortcut or Siri"}
          keywords="api key siri shortcut back tap quick log photo">
          <ShortcutKeys keys={user.apiKeys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null }))} />
        </Collapsible>

        <Collapsible id="account" title="Units and sign-in" icon={<UserRound size={20} />}
          summary={`${imperial ? "Pounds and feet" : "Kilograms and centimeters"}${user.passwordHash ? ", password set" : ""}`}
          keywords="units pounds kilograms metric imperial password email sign in">
          <form action={setUnitSystem} className="mt-3 flex gap-2" aria-label="Units">
            {(["IMPERIAL", "METRIC"] as const).map((u) => (
              <button key={u} name="unitSystem" value={u} aria-pressed={user.unitSystem === u}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium ${user.unitSystem === u ? "border-plate-yellow text-chalk" : "border-rack-line text-chalk-muted"}`}>
                {u === "IMPERIAL" ? "Pounds, feet" : "Kilograms, cm"}
              </button>
            ))}
          </form>
          <SetPasswordForm hasPassword={!!user.passwordHash} email={user.email} />
        </Collapsible>

        <Collapsible id="invite" title="Invite friends" icon={<Users size={20} />} summary="Share a link or QR code" keywords="share qr friends invite">
          <InviteCard url={siteUrl} qrSvg={qrSvg} />
        </Collapsible>

        <Collapsible id="privacy" title="Privacy and account" icon={<Shield size={20} />}
          summary={`AI requests today: ${aiUsed}${Number.isFinite(aiLimit) ? ` of ${aiLimit}` : ""}`}
          keywords="privacy delete account data ai usage limit">
          <p className="mt-3 text-sm text-chalk-muted">
            AI requests today: {aiUsed}{Number.isFinite(aiLimit) ? ` of ${aiLimit}` : " (no limit for the app owner)"}. Barcode, search, and saved meals don&apos;t count.
          </p>
          <p className="mt-3 text-sm"><Link href="/privacy" className="underline underline-offset-4">What Calorness stores and shares</Link></p>
          <div className="mt-4"><DeleteAccount /></div>
        </Collapsible>
      </SearchableSections>
      <div className="h-8" />
    </>
  );
}
