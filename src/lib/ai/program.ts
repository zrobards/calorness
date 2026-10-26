import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { getExerciseOptions } from "@/lib/training";
import { searchByName } from "@/components/train/muscleFilters";
import { claudeMessages, coachModel, DEFAULTS } from "./claude";

// AI-built training programs: a few routines (days) with exercises, sets,
// rep ranges, and rest, matched to real exercises in the library so they
// can be edited and saved like any routine.

export type ProgramExercise = { exerciseId: string; name: string; sets: number; repMin: number; repMax: number; restSeconds: number; note?: string };
export type ProgramDay = { name: string; exercises: ProgramExercise[] };
export type ProgramDraft = { name: string; summary: string; days: ProgramDay[]; unmatched: string[] };

export const PROGRAM_TOOL = {
  name: "create_program",
  description: "Return a complete training program: one routine per training day, with exercises in the order they should be done.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short program name, e.g. 'Upper/Lower Strength'" },
      summary: { type: "string", description: "Two sentences: how to run it (which days, how to progress)" },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "e.g. 'Push', 'Lower A', 'Full Body 1'" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  exercise: { type: "string", description: "Common exercise name, e.g. 'Barbell Bench Press', 'Lat Pulldown', 'Pec Deck'" },
                  sets: { type: "integer" },
                  rep_min: { type: "integer" },
                  rep_max: { type: "integer" },
                  rest_seconds: { type: "integer" },
                  note: { type: "string", description: "Optional cue, e.g. 'pause at the bottom'" },
                },
                required: ["exercise", "sets", "rep_min", "rep_max", "rest_seconds"],
              },
            },
          },
          required: ["name", "exercises"],
        },
      },
    },
    required: ["name", "summary", "days"],
  },
} as const;

export const programInput = z.object({
  name: z.string().min(1).max(60),
  summary: z.string().max(400).default(""),
  days: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        exercises: z
          .array(
            z.object({
              exercise: z.string().min(1).max(100),
              sets: z.number().int().min(1).max(10),
              rep_min: z.number().int().min(1).max(100),
              rep_max: z.number().int().min(1).max(100),
              rest_seconds: z.number().int().min(0).max(600).default(90),
              note: z.string().max(120).optional(),
            }),
          )
          .min(1)
          .max(15),
      }),
    )
    .min(1)
    .max(7),
});

export type ProgramPrefs = {
  goal: string;
  daysPerWeek: number;
  minutes: number;
  equipment: string;
  experience: string;
  focus: string[];
  avoid: string;
};

const SYSTEM = `You are an expert strength coach writing a training program for the Calorness app.
Write programs a real coach would: compound lifts first, sensible weekly volume (about 10 to 20 hard sets per muscle per week), rep ranges that fit the goal, and rest times that fit the lift.
Respect the session length: roughly 2.5 to 3 minutes per working set including rest.
Use only the equipment available. Work around any pain or injuries with pain-free alternatives, never through them.
Use common exercise names that a gym-goer would recognize. Always answer by calling the create_program tool.`;

/** Match exercise names to the library (exact name first, then the alias-aware search). */
export async function resolveExercises(userId: string, items: { exercise: string; sets: number; rep_min: number; rep_max: number; rest_seconds?: number; note?: string }[]) {
  const options = await getExerciseOptions(userId);
  const exercises: ProgramExercise[] = [];
  const unmatched: string[] = [];
  for (const e of items) {
    const match = options.find((o) => o.name.toLowerCase() === e.exercise.toLowerCase()) ?? searchByName(options, e.exercise)[0];
    if (!match) {
      unmatched.push(e.exercise);
      continue;
    }
    exercises.push({
      exerciseId: match.id,
      name: match.name,
      sets: e.sets,
      repMin: Math.min(e.rep_min, e.rep_max),
      repMax: Math.max(e.rep_min, e.rep_max),
      restSeconds: e.rest_seconds ?? 90,
      ...(e.note ? { note: e.note } : {}),
    });
  }
  return { exercises, unmatched };
}

/** Turn the AI's program into a draft with real library exercises. */
export async function toDraft(userId: string, input: z.infer<typeof programInput>): Promise<ProgramDraft> {
  const unmatched: string[] = [];
  const days: ProgramDay[] = [];
  for (const d of input.days) {
    const r = await resolveExercises(userId, d.exercises);
    unmatched.push(...r.unmatched);
    if (r.exercises.length) days.push({ name: d.name, exercises: r.exercises });
  }
  return { name: input.name, summary: input.summary, days, unmatched };
}

function describeDraft(d: ProgramDraft) {
  return d.days
    .map((day) => `${day.name}:\n${day.exercises.map((e) => `- ${e.name} ${e.sets}x${e.repMin}-${e.repMax}, rest ${e.restSeconds}s${e.note ? ` (${e.note})` : ""}`).join("\n")}`)
    .join("\n\n");
}

/** Build a new program from preferences, or revise an existing draft with an instruction. */
export async function generateProgram(
  userId: string,
  request: { prefs: ProgramPrefs } | { draft: ProgramDraft; instruction: string },
): Promise<ProgramDraft | { error: string }> {
  const injuries = await db.coachNote.findMany({ where: { userId, active: true, kind: { in: ["injury", "preference"] } }, select: { text: true } });
  const notes = injuries.length ? `\nThings to keep in mind about this person:\n${injuries.map((n) => `- ${n.text}`).join("\n")}` : "";

  const ask =
    "prefs" in request
      ? `Build a program.
Goal: ${request.prefs.goal}
Days per week: ${request.prefs.daysPerWeek}
Minutes per session: ${request.prefs.minutes}
Equipment: ${request.prefs.equipment}
Experience: ${request.prefs.experience}
${request.prefs.focus.length ? `Extra focus on: ${request.prefs.focus.join(", ")}` : ""}
${request.prefs.avoid.trim() ? `Avoid or work around: ${request.prefs.avoid.trim()}` : ""}${notes}`
      : `Here is the current program "${request.draft.name}":\n\n${describeDraft(request.draft)}\n\nChange it like this: "${request.instruction}". Keep everything else the same unless the change requires it. Return the complete program.${notes}`;

  try {
    const body = (await claudeMessages(
      { model: coachModel(), max_tokens: 3000, system: SYSTEM, tools: [PROGRAM_TOOL], tool_choice: { type: "tool", name: PROGRAM_TOOL.name }, messages: [{ role: "user", content: ask }] },
      DEFAULTS.text,
      60_000,
    )) as { content: { type: string; name?: string; input?: unknown }[] };
    const call = body.content.find((b) => b.type === "tool_use" && b.name === PROGRAM_TOOL.name);
    const parsed = programInput.safeParse(stripNullsDeep(call?.input));
    if (!parsed.success) return { error: "The AI's program didn't come out right. Try again." };
    const draft = await toDraft(userId, parsed.data);
    return draft.days.length ? draft : { error: "Couldn't match the program's exercises. Try again." };
  } catch (e) {
    return { error: e instanceof Error && "userMessage" in e ? String((e as { userMessage: string }).userMessage) : "The AI couldn't build that right now. Try again." };
  }
}

/** Save each day of a program as a routine. */
export async function saveProgram(userId: string, draft: ProgramDraft) {
  const position = await db.routine.count({ where: { userId } });
  await db.$transaction(
    draft.days.map((day, i) =>
      db.routine.create({
        data: {
          userId,
          name: draft.days.length > 1 ? `${day.name}` : draft.name,
          notes: [`From your program "${draft.name}"`, draft.summary].filter(Boolean).join(". "),
          position: position + i,
          exercises: {
            create: day.exercises.map((e, order) => ({
              exerciseId: e.exerciseId,
              order,
              targetSets: e.sets,
              targetRepsMin: e.repMin,
              targetRepsMax: e.repMax,
              restSeconds: e.restSeconds,
              notes: e.note ?? null,
            })),
          },
        },
      }),
    ),
  );
}

function stripNullsDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNullsDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNullsDeep(x)]));
  return v;
}
