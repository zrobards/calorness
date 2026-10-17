import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { getExerciseOptions } from "@/lib/training";
import { searchByName } from "@/components/train/muscleFilters";
import { bestSet } from "@/lib/fitness/strength";
import { displayWeight, weightUnit } from "@/lib/fitness/units";
import { dayInZone } from "@/lib/time";
import { claudeMessages, coachModel, DEFAULTS } from "./claude";

// The coach is Claude with three tools: remember things you tell it
// (injuries, goals, preferences), forget them, and propose a reworked
// routine that you can apply with one tap. It always sees your routines,
// recent workouts, goals, and what it remembers.



const TOOLS = [
  {
    name: "remember",
    description:
      "Save something the user wants you to keep in mind across conversations: an injury or pain, a goal, a preference, equipment they have or lack. Use whenever they share something like that. Keep it short and specific, with the date if relevant.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["injury", "goal", "preference", "other"] },
        text: { type: "string", description: "e.g. 'Left shoulder pain on overhead and incline pressing (Oct 14)'" },
      },
      required: ["kind", "text"],
    },
  },
  {
    name: "forget",
    description: "Stop keeping a note in mind, e.g. when an injury has healed or a goal changed. Use the note id from the context.",
    input_schema: { type: "object", properties: { note_id: { type: "string" } }, required: ["note_id"] },
  },
  {
    name: "propose_routine",
    description:
      "Suggest a new or reworked routine. The user sees it as a card with buttons to replace their routine or save it as a new one. Use real, common exercise names.",
    input_schema: {
      type: "object",
      properties: {
        replaces_routine_id: { type: "string", description: "Id of the routine this reworks, if any" },
        name: { type: "string" },
        reason: { type: "string", description: "One sentence on what changed and why" },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              exercise: { type: "string", description: "Exercise name, e.g. 'Machine Chest Press'" },
              sets: { type: "integer" },
              rep_min: { type: "integer" },
              rep_max: { type: "integer" },
              rest_seconds: { type: "integer" },
            },
            required: ["exercise", "sets", "rep_min", "rep_max"],
          },
        },
      },
      required: ["name", "reason", "exercises"],
    },
  },
] as const;

const SYSTEM = `You are Coach, the training and nutrition coach inside Calorness, a workout and food tracking app.
Be warm, direct, and brief: a few sentences, or a short list when listing exercises. No long essays.
Use the user's actual data below. When they mention an injury, a goal, or a preference, save it with the remember tool.
When their plan should change (pain, plateau, new goal, missing equipment), use propose_routine instead of only describing changes.

Safety rules:
- You are not a doctor or physical therapist. For pain, suggest pain-free alternatives and lighter loading, never "push through" sharp pain.
- Recommend seeing a doctor or physical therapist if pain is sharp, comes with swelling, numbness, tingling, or weakness, or lasts more than a week or two.
- Don't suggest crash diets or very low calorie targets. If someone describes restricting food, bingeing, purging, or exercising to "make up" for eating, respond with care and encourage talking to a professional instead of giving numbers.`;

export type ProposalExercise = { exerciseId: string; name: string; sets: number; repMin: number; repMax: number; restSeconds: number };
export type CoachProposal = {
  name: string;
  reason: string;
  replacesRoutineId: string | null;
  replacesRoutineName: string | null;
  exercises: ProposalExercise[];
  unmatched: string[];
};

async function buildContext(userId: string) {
  const [user, goal, notes, routines, workouts, weights] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, unitSystem: true, timeZone: true } }),
    db.goal.findUnique({ where: { userId } }),
    db.coachNote.findMany({ where: { userId, active: true }, orderBy: { createdAt: "asc" } }),
    db.routine.findMany({
      where: { userId },
      include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } } } } },
    }),
    db.workout.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } }, sets: true } } },
    }),
    db.bodyweightEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 14 }),
  ]);
  const unit = weightUnit(user.unitSystem);
  const w = (kg: number) => displayWeight(kg, user.unitSystem);

  const lines = [
    `Today is ${dayInZone(new Date(), user.timeZone)}. Name: ${user.name ?? "unknown"}. Units: ${unit}.`,
    goal ? `Daily targets: ${goal.calories} cal, ${goal.proteinG}g protein, ${goal.carbsG}g carbs, ${goal.fatG}g fat. Goal: ${goal.goalType.toLowerCase()}.` : "No nutrition targets set yet.",
    weights.length ? `Bodyweight: latest ${w(weights[0].weightKg)} ${unit}${weights.length > 1 ? `, ${w(weights[weights.length - 1].weightKg)} ${unit} two weeks ago` : ""}.` : "",
    "",
    "What you remember about them (note id: note):",
    ...(notes.length ? notes.map((n) => `- ${n.id}: [${n.kind}] ${n.text}`) : ["- nothing yet"]),
    "",
    "Their routines (routine id: name, then exercises):",
    ...(routines.length
      ? routines.map(
          (r) => `- ${r.id}: ${r.name}: ${r.exercises.map((e) => `${e.exercise.name} ${e.targetSets}x${e.targetRepsMin ?? "?"}-${e.targetRepsMax ?? "?"}`).join("; ")}`,
        )
      : ["- none yet"]),
    "",
    "Recent workouts (newest first, best set per exercise):",
    ...(workouts.length
      ? workouts.map((wk) => {
          const ex = wk.exercises
            .map((e) => {
              const b = bestSet(e.sets);
              return b ? `${e.exercise.name} ${w(b.set.weightKg ?? 0)}${unit}x${b.set.reps}` : e.exercise.name;
            })
            .join("; ");
          return `- ${dayInZone(wk.startedAt, user.timeZone)} ${wk.name}: ${ex}${wk.notes ? ` (notes: ${wk.notes})` : ""}`;
        })
      : ["- none yet"]),
  ];
  return { text: lines.filter((l) => l !== undefined).join("\n"), routines };
}

type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown };
type Message = { role: "user" | "assistant"; content: string | unknown[] };

async function callClaude(system: string, messages: Message[]) {
  return (await claudeMessages({ model: coachModel(), max_tokens: 1200, system, tools: TOOLS, messages }, DEFAULTS.text, 45_000)) as {
    content: Block[];
    stop_reason: string;
  };
}

const proposalInput = z.object({
  replaces_routine_id: z.string().optional(),
  name: z.string().min(1).max(60),
  reason: z.string().max(300).default(""),
  exercises: z
    .array(
      z.object({
        exercise: z.string().min(1).max(100),
        sets: z.number().int().min(1).max(10),
        rep_min: z.number().int().min(1).max(100),
        rep_max: z.number().int().min(1).max(100),
        rest_seconds: z.number().int().min(0).max(600).optional(),
      }),
    )
    .min(1)
    .max(15),
});

/** One coach turn: may save notes and produce a routine proposal along the way. */
export async function runCoach(userId: string, history: { role: "user" | "assistant"; content: string }[], userText: string) {
  const { text: context, routines } = await buildContext(userId);
  const system = `${SYSTEM}\n\n--- The user's data ---\n${context}`;
  const messages: Message[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userText }];
  let proposal: CoachProposal | null = null;
  const notesChanged: string[] = [];
  let reply = "";

  for (let round = 0; round < 4; round++) {
    const res = await callClaude(system, messages);
    reply = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() || reply;
    const calls = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || calls.length === 0) break;

    const results: unknown[] = [];
    for (const call of calls) {
      let output = "done";
      if (call.name === "remember") {
        const p = z.object({ kind: z.enum(["injury", "goal", "preference", "other"]), text: z.string().min(2).max(200) }).safeParse(call.input);
        if (p.success) {
          const n = await db.coachNote.create({ data: { userId, kind: p.data.kind, text: p.data.text } });
          notesChanged.push(`Remembered: ${p.data.text}`);
          output = `saved as ${n.id}`;
        } else output = "invalid note";
      } else if (call.name === "forget") {
        const id = z.object({ note_id: z.string() }).safeParse(call.input);
        if (id.success) {
          const r = await db.coachNote.updateMany({ where: { id: id.data.note_id, userId }, data: { active: false } });
          output = r.count ? "forgotten" : "no such note";
          if (r.count) notesChanged.push("Forgot a note");
        }
      } else if (call.name === "propose_routine") {
        const p = proposalInput.safeParse(call.input);
        if (p.success) {
          proposal = await resolveProposal(userId, p.data, routines);
          output = proposal.unmatched.length
            ? `Shown to the user. These exercises weren't found in the library and were left out: ${proposal.unmatched.join(", ")}`
            : "Shown to the user with Replace and Save-as-new buttons.";
        } else output = "invalid routine";
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: output });
    }
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: results });
  }

  return { reply: reply || "Done.", proposal, notesChanged };
}

async function resolveProposal(
  userId: string,
  input: z.infer<typeof proposalInput>,
  routines: { id: string; name: string }[],
): Promise<CoachProposal> {
  const options = await getExerciseOptions(userId);
  const exercises: ProposalExercise[] = [];
  const unmatched: string[] = [];
  for (const e of input.exercises) {
    // exact name first, then the same alias-aware search the app uses
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
    });
  }
  const replaced = routines.find((r) => r.id === input.replaces_routine_id) ?? null;
  return {
    name: input.name,
    reason: input.reason,
    replacesRoutineId: replaced?.id ?? null,
    replacesRoutineName: replaced?.name ?? null,
    exercises,
    unmatched,
  };
}
