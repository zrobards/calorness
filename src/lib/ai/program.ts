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
// A day can be built around a sport or climbing session ("Bouldering, 60–90 min"),
// with supporting exercises, or none at all.
export type ProgramDay = { name: string; activity?: string; exercises: ProgramExercise[] };
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
            name: { type: "string", description: "e.g. 'Push', 'Lower A', 'Climb + Core'" },
            activity: { type: "string", description: "Only for days built around a sport or session outside the weight room, e.g. 'Bouldering, 60-90 min, project hard problems'. Leave out on pure lifting days." },
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
          required: ["name"],
        },
      },
    },
    required: ["name", "summary", "days"],
  },
} as const;

export const programInput = z.object({
  name: z.string().min(1).max(60),
  summary: z.string().max(600).default(""),
  days: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        activity: z.string().max(400).optional(),
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
          .max(15)
          .default([]),
      }).refine((d) => d.exercises.length > 0 || !!d.activity, "Each day needs exercises or an activity"),
    )
    .min(1)
    .max(7),
});

/**
 * Models sometimes send a slightly-off program: numbers as text ("3"),
 * arrays as JSON strings, 12 sets, rest in minutes, nulls for "not set".
 * Fix what can be fixed safely so a good program isn't thrown away.
 */
export function repairProgram(raw: unknown): unknown {
  const parseMaybe = (v: unknown) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  };
  const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN);
  const int = (v: unknown, lo: number, hi: number, fallback: number) => {
    const n = Math.round(num(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

  const p = parseMaybe(raw);
  if (!p || typeof p !== "object") return p;
  const prog = p as Record<string, unknown>;
  const days = parseMaybe(prog.days);
  if (!Array.isArray(days)) return { ...prog, days };
  return {
    name: text(prog.name, 60) ?? "My program",
    summary: text(prog.summary, 600) ?? "",
    days: days.slice(0, 7).map((d0, i) => {
      const d = (parseMaybe(d0) ?? {}) as Record<string, unknown>;
      const exs = parseMaybe(d.exercises);
      return {
        name: text(d.name, 40) ?? `Day ${i + 1}`,
        activity: text(d.activity, 400),
        exercises: (Array.isArray(exs) ? exs : [])
          .map((e0) => (parseMaybe(e0) ?? {}) as Record<string, unknown>)
          .filter((e) => text(e.exercise ?? e.name, 100))
          .slice(0, 15)
          .map((e) => {
            const repMin = int(e.rep_min ?? e.reps, 1, 100, 8);
            const repMax = int(e.rep_max ?? e.reps, 1, 100, Math.max(repMin, 12));
            let rest = num(e.rest_seconds);
            if (Number.isFinite(rest) && rest > 0 && rest <= 10) rest *= 60; // "3" meant minutes
            return {
              exercise: text(e.exercise ?? e.name, 100)!,
              sets: int(e.sets, 1, 10, 3),
              rep_min: Math.min(repMin, repMax),
              rep_max: Math.max(repMin, repMax),
              rest_seconds: Number.isFinite(rest) ? Math.min(600, Math.max(0, Math.round(rest))) : 90,
              note: text(e.note, 120),
            };
          }),
      };
    }),
  };
}

export type ProgramPrefs = {
  goal: string;
  daysPerWeek: number;
  minutes: number;
  equipment: string;
  experience: string;
  focus: string[];
  avoid: string;
  /** Sports or sessions outside the gym to build around, e.g. climbing */
  activities?: string[];
  /** Anything else, in their own words */
  request?: string;
};

const SYSTEM = `You are an expert strength coach writing a training program for the Calorness app.
Write programs a real coach would: compound lifts first, sensible weekly volume (about 10 to 20 hard sets per muscle per week), rep ranges that fit the goal, and rest times that fit the lift.
Respect the session length: roughly 2.5 to 3 minutes per working set including rest.
Use only the equipment available. Work around any pain or injuries with pain-free alternatives, never through them.
Use common exercise names that a gym-goer would recognize. Always answer by calling the create_program tool.

When the person does a sport or climbs:
- Give each sport session its own day with "activity" set (what to do and for how long), plus a short block of supporting exercises if useful (warm-up, core, antagonists). Count those sessions toward "days per week".
- Climbing: climbing already trains fingers, forearms, lats, and biceps hard. On lifting days, prioritize legs, glutes, pushing (chest, shoulders, triceps), shoulder health (face pulls, external rotation), core, and antagonist work (reverse wrist curls, finger extensor band opens). Keep heavy pulling and grip work light, and not the day before a climbing session. Add hangboard work only for experienced climbers, at most twice a week, never to failure.
- Make sure every major muscle is trained at least twice a week across the plan.`;

/** Match exercise names to the library (exact name first, then the alias-aware search). */
export async function resolveExercises(userId: string, items: { exercise: string; sets: number; rep_min: number; rep_max: number; rest_seconds?: number; note?: string }[]) {
  const options = await getExerciseOptions(userId);
  const exercises: ProgramExercise[] = [];
  const unmatched: string[] = [];
  for (const e of items) {
    const match = options.find((o) => o.name.toLowerCase() === e.exercise.toLowerCase()) ?? searchByName(options, e.exercise)[0] ?? closestExercise(options, e.exercise);
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

/**
 * Last resort for names the search misses because of one extra word
 * ("Barbell Back Squat" vs "Back Squat" / "Barbell Squat"): the exercise
 * whose name or alias shares the most words, if it shares most of them.
 */
export function closestExercise<T extends { name: string; aliases?: string[] }>(options: T[], query: string): T | undefined {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/s$/, ""));
  const q = words(query);
  if (q.length < 2) return undefined;
  let best: { o: T; score: number } | undefined;
  for (const o of options) {
    for (const text of [o.name, ...(o.aliases ?? [])]) {
      const t = new Set(words(text));
      const shared = q.filter((w) => t.has(w)).length;
      const score = shared / Math.max(q.length, t.size);
      if (shared >= 2 && score >= 0.6 && (!best || score > best.score || (score === best.score && o.name.length < best.o.name.length))) best = { o, score };
    }
  }
  return best?.o;
}

/** Turn the AI's program into a draft with real library exercises. */
export async function toDraft(userId: string, input: z.infer<typeof programInput>): Promise<ProgramDraft> {
  const unmatched: string[] = [];
  const days: ProgramDay[] = [];
  for (const d of input.days) {
    const r = await resolveExercises(userId, d.exercises);
    unmatched.push(...r.unmatched);
    if (r.exercises.length || d.activity) days.push({ name: d.name, ...(d.activity ? { activity: d.activity } : {}), exercises: r.exercises });
  }
  return { name: input.name, summary: input.summary, days, unmatched };
}

function describeDraft(d: ProgramDraft) {
  return d.days
    .map((day) => `${day.name}${day.activity ? ` (activity: ${day.activity})` : ""}:\n${day.exercises.map((e) => `- ${e.name} ${e.sets}x${e.repMin}-${e.repMax}, rest ${e.restSeconds}s${e.note ? ` (${e.note})` : ""}`).join("\n")}`)
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
${request.prefs.activities?.length ? `Also does (schedule these as activity days): ${request.prefs.activities.join(", ")}` : ""}
${request.prefs.avoid.trim() ? `Avoid or work around: ${request.prefs.avoid.trim()}` : ""}
${request.prefs.request?.trim() ? `In their words: "${request.prefs.request.trim()}"` : ""}${notes}`
      : `Here is the current program "${request.draft.name}":\n\n${describeDraft(request.draft)}\n\nChange it like this: "${request.instruction}". Keep everything else the same unless the change requires it. Return the complete program.${notes}`;

  type Block = { type: string; id?: string; name?: string; input?: unknown };
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: ask }];
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = (await claudeMessages(
        { model: coachModel(), max_tokens: 8000, system: SYSTEM, tools: [PROGRAM_TOOL], tool_choice: { type: "tool", name: PROGRAM_TOOL.name }, messages },
        DEFAULTS.text,
        110_000,
      )) as { content: Block[]; stop_reason?: string };
      const call = body.content.find((b) => b.type === "tool_use" && b.name === PROGRAM_TOOL.name);
      if (!call) {
        if (attempt === 0) {
          messages.push({ role: "assistant", content: body.content }, { role: "user", content: "Please answer by calling the create_program tool with the complete program." });
          continue;
        }
        return { error: "The AI answered without a program. Try again, or add more detail about what you want." };
      }
      const parsed = programInput.safeParse(repairProgram(stripNullsDeep(call.input)));
      if (parsed.success) {
        const draft = await toDraft(userId, parsed.data);
        if (draft.days.length) return draft;
        return { error: "None of the program's exercises matched the exercise library. Try again." };
      }
      const problem = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      console.error("program validation failed", body.stop_reason, problem);
      if (body.stop_reason === "max_tokens" || attempt === 1) {
        return { error: body.stop_reason === "max_tokens" ? "That program came out too long. Try fewer days or shorter sessions." : `The AI's program didn't come out right (${problem}). Try again.` };
      }
      // Tell the model exactly what was wrong and let it fix it once
      messages.push(
        { role: "assistant", content: body.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Invalid program: ${problem}. Call create_program again with the complete, corrected program.` }] },
      );
    }
    return { error: "The AI couldn't build that right now. Try again." };
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
          notes: [day.activity, `From your program "${draft.name}"`].filter(Boolean).join(". "),
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
