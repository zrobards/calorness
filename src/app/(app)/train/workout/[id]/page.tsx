import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkoutLoggerClient } from "@/components/train/WorkoutLoggerClient";
import { requireUser } from "@/lib/auth";
import { loadLoggerProps } from "@/lib/logger-props";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await loadLoggerProps(user.id, id);
  if (!data) notFound();
  if (data.ended) redirect(`/train/history/${id}`);
  return <WorkoutLoggerClient {...data.props} mode="live" />;
}
