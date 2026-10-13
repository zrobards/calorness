import type { Metadata } from "next";
import Link from "next/link";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MacroBars } from "@/components/MacroBars";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Diary" };

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export default async function DiaryPage() {
  const user = await requireUser();
  const goal = await db.goal.findUnique({ where: { userId: user.id } });

  return (
    <>
      <PageHeader title="Diary" />
      {goal ? (
        <>
          <section className="mx-5 rounded-2xl bg-rack-raised p-5" aria-label="Today's totals">
            <MacroBars eaten={{ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }} goal={goal} />
          </section>
          <ul className="mx-5 mt-4 divide-y divide-rack-line rounded-2xl bg-rack-raised">
            {MEALS.map((meal) => (
              <li key={meal} className="flex items-center justify-between px-5 py-4">
                <span className="font-display text-xl font-semibold">{meal}</span>
                <span className="text-sm text-chalk-muted">0 cal</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState Icon={Target} title="Set your daily targets">
          Calorness needs a calorie and macro goal before it can track your day.{" "}
          <Link href="/profile#goals" className="font-medium text-chalk underline underline-offset-4">
            Set goals in Profile
          </Link>
        </EmptyState>
      )}
    </>
  );
}
