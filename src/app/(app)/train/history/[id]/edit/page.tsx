import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkoutLoggerClient } from "@/components/train/WorkoutLoggerClient";
import { requireUser } from "@/lib/auth";
import { loadLoggerProps } from "@/lib/logger-props";

export const metadata: Metadata = { title: "Edit workout" };

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await loadLoggerProps(user.id, id);
  if (!data) notFound();
  if (!data.ended) redirect(`/train/workout/${id}`);
  return <WorkoutLoggerClient {...data.props} mode="edit" />;
}
