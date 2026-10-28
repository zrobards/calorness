"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExercise } from "@/lib/clientActions";

export function DeleteExerciseButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <button
        disabled={pending}
        onClick={() => confirm("Delete this exercise?") && start(async () => {
          const r = await deleteExercise(id);
          if (r.error) setError(r.error);
          else router.push("/train/exercises");
        })}
        className="text-sm font-medium text-chalk-muted hover:text-plate-red"
      >
        {pending ? "Deleting…" : "Delete this exercise"}
      </button>
      {error && <p className="mt-1 text-sm text-chalk-muted">{error}</p>}
    </div>
  );
}
