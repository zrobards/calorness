"use client";

import { useTransition } from "react";
import { deleteWorkout } from "@/lib/clientActions";

export function DeleteWorkoutButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => confirm("Delete this workout from your history?") && start(async () => { await deleteWorkout(id); })}
      className="text-sm font-medium text-chalk-muted hover:text-plate-red"
    >
      {pending ? "Deleting…" : "Delete workout"}
    </button>
  );
}
