export type SetType = "WARMUP" | "NORMAL" | "DROP" | "FAILURE";
export type LoggerSet = { id: string; type: SetType; weight: number | null; reps: number | null; completed: boolean };
export type PreviousSet = { weight: number | null; reps: number | null; type: string };
export type LoggerExercise = {
  key: string;
  exerciseId: string;
  name: string;
  muscles: string[];
  image: string | null;
  restSeconds: number;
  repMin?: number | null;
  repMax?: number | null;
  equipment?: string | null;
  sets: LoggerSet[];
};
