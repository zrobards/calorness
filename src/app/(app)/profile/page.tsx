import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoalForm } from "./GoalForm";
import { setUnitSystem } from "./actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: { goal: true },
  });

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
      </section>

      <section id="goals" className="mx-5 mt-4 rounded-2xl bg-rack-raised p-5">
        <h2 className="font-display text-2xl font-semibold">Daily targets</h2>
        {user.goal ? (
          <p className="mt-1 text-chalk-muted">
            {user.goal.calories.toLocaleString()} calories, {user.goal.proteinG}g protein,{" "}
            {user.goal.carbsG}g carbs, {user.goal.fatG}g fat. Recalculate below any time.
          </p>
        ) : (
          <p className="mt-1 text-chalk-muted">
            Answer a few questions and Calorness will estimate your calories and macros.
          </p>
        )}
        <div className="mt-5">
          <GoalForm unitSystem={user.unitSystem} />
        </div>
      </section>
    </>
  );
}
