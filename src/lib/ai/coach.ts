import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { bestSet } from "@/lib/fitness/strength";
import { displayWeight, weightUnit } from "@/lib/fitness/units";
import { dayInZone } from "@/lib/time";
import { claudeMessages, coachModel, DEFAULTS } from "./claude";
import { PROGRAM_TOOL, programInput, repairProgram, resolveExercises, toDraft, type ProgramDraft } from "./program";

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
  {
    name: "propose_program",
    description:
      "Suggest a whole multi-day training program (one routine per day). The user sees it as a card they can customize and save. Use this when they ask for a plan, a split, or a program.",
    input_schema: PROGRAM_TOOL.input_schema,
  },
] as const;

const SYSTEM = `You are Coach, the training and nutrition coach inside Calorness, a workout and food tracking app.
Be warm, direct, and brief: a few sentences, or a short list when listing exercises. No long essays.
Use the user's actual data below. When they mention an injury, a goal, or a preference, save it with the remember tool.
When their plan should change (pain, plateau, new goal, missing equipment), use propose_routine for one day or propose_program for a whole plan, instead of only describing changes.

Honesty about tools:
- Only say you've made, built, sent, or saved something if your tool call in this turn succeeded (you'll see its result). If a tool returns an error, fix the input and call it again.
- For two or more days, call propose_program once with all of them. Use propose_routine only for a single routine.
- Never answer with just "Done." Say what you did in a sentence.

How to write:
- Talk like a good coach texting a client: short paragraphs, plain words, one idea at a time.
- Use a bulleted list (lines starting with "- ") for exercises or steps, and **bold** only for the one thing that matters most.
- No tables, no headings, no long preambles. Don't repeat the program's exercises in text when you've proposed it with a tool; just say what it's built around and why.
- Ask one short question when you genuinely need information (days available, equipment) instead of guessing.

Safety rules:
- You are not a doctor or physical therapist. For pain, suggest pain-free alternatives and lighter loading, never "push through" sharp pain.
- Recommend seeing a doctor or physical therapist if pain is sharp, comes with swelling, numbness, tingling, or weakness, or lasts more than a week or two.
- Don't suggest crash diets or very low calorie targets. If someone describes restricting food, bingeing, purging, or exercising to "make up" for eating, respond with care and encourage talking to a professional instead of giving numbers.`;

export type ProposalExercise = { exerciseId: string; name: string; sets: number; repMin: number; repMax: number; restSeconds: number };
export type CoachProgramProposal = { kind: "program"; draft: ProgramDraft };
export type CoachProposal = {
  name: string;
  reason: string;
  replacesRoutineId: string | null;
  replacesRoutineName: string | null;
  exercises: ProposalExercise[];
  unmatched: string[];
};

async function buildContext(userId: string) {
  const [user, goal, notes, routines, workouts, weights, activities] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, unitSystem: true, timeZone: true } }),
    db.goal.findUnique({ where: { userId } }),
    db.coachNote.findMany({ where: { userId, active: true }, orderBy: { createdAt: "asc" } }),
    db.routine.findMany({
      where: { userId },
      include: { program: { select: { name: true } }, exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } } } } },
    }),
    db.workout.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { name: true } }, sets: true } } },
    }),
    db.bodyweightEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 14 }),
    db.activityEntry.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 10 }),
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
          (r) => `- ${r.id}: ${r.name}${r.program ? ` (in program "${r.program.name}")` : ""}: ${r.exercises.map((e) => `${e.exercise.name} ${e.targetSets}x${e.targetRepsMin ?? "?"}-${e.targetRepsMax ?? "?"}`).join("; ")}`,
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
    "",
    "Recent cardio and activities (newest first):",
    ...(activities.length
      ? activities.map((a) => `- ${a.date.toISOString().slice(0, 10)} ${a.name} (${a.intensity}), ${Math.round(a.durationMin)} min, ~${a.caloriesTotal} cal`)
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
/** Models often send null for "not set"; zod's optional() only accepts missing. Drop the nulls. */
export function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNulls(x)]));
  return v;
}

const issues = (e: z.ZodError) => e.issues.slice(0, 5).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");

// The reply claims something was made or sent ("here they are", "I've built")
const CLAIMS_DELIVERY = /\b(here (it|they|'s|is|are)|i('ve| have) (made|built|created|put together|sent|saved|updated)|done\b)/i;

export async function runCoach(userId: string, history: { role: "user" | "assistant"; content: string }[], userText: string) {
  const { text: context, routines } = await buildContext(userId);
  const system = `${SYSTEM}\n\n--- The user's data ---\n${context}`;
  const messages: Message[] = [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userText }];
  const routineProposals: CoachProposal[] = [];
  let program: CoachProgramProposal | null = null;
  const notesChanged: string[] = [];
  let reply = "";
  let nudged = false;

  for (let round = 0; round < 6; round++) {
    const res = await callClaude(system, messages);
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (text) reply = text;
    const calls = res.content.filter((b) => b.type === "tool_use");

    if (res.stop_reason !== "tool_use" || calls.length === 0) {
      // Honesty check: it says it made something, but no tool call worked this turn.
      // Ask it once to actually do it (or to say it couldn't).
      if (!nudged && !program && routineProposals.length === 0 && CLAIMS_DELIVERY.test(reply)) {
        nudged = true;
        messages.push({ role: "assistant", content: res.content });
        messages.push({
          role: "user",
          content: "(App check: your reply says you made or sent something, but no propose_routine or propose_program call succeeded in this turn, so the user sees nothing. Call the tool now. Use propose_program for more than one day. If you can't, say so plainly.)",
        });
        continue;
      }
      break;
    }

    const results: unknown[] = [];
    for (const call of calls) {
      const input = stripNulls(call.input);
      let output = "done";
      let isError = false;
      if (call.name === "remember") {
        const p = z.object({ kind: z.enum(["injury", "goal", "preference", "other"]), text: z.string().min(2).max(200) }).safeParse(input);
        if (p.success) {
          const n = await db.coachNote.create({ data: { userId, kind: p.data.kind, text: p.data.text } });
          notesChanged.push(`Remembered: ${p.data.text}`);
          output = `saved as ${n.id}`;
        } else [output, isError] = [`Error: ${issues(p.error)}. Fix it and call remember again.`, true];
      } else if (call.name === "forget") {
        const id = z.object({ note_id: z.string() }).safeParse(input);
        if (id.success) {
          const r = await db.coachNote.updateMany({ where: { id: id.data.note_id, userId }, data: { active: false } });
          output = r.count ? "forgotten" : "no such note";
          if (r.count) notesChanged.push("Forgot a note");
        } else [output, isError] = ["Error: note_id is required.", true];
      } else if (call.name === "propose_routine") {
        const p = proposalInput.safeParse(input);
        if (p.success) {
          const proposal = await resolveProposal(userId, p.data, routines);
          routineProposals.push(proposal);
          output = `Shown to the user as a card with Save buttons.${proposal.unmatched.length ? ` Left out (not in the library): ${proposal.unmatched.join(", ")}` : ""}`;
        } else [output, isError] = [`Error, nothing was shown: ${issues(p.error)}. Fix the input and call propose_routine again.`, true];
      } else if (call.name === "propose_program") {
        const p = programInput.safeParse(repairProgram(input));
        if (p.success) {
          const draft = await toDraft(userId, p.data);
          program = { kind: "program", draft };
          output = `Shown to the user as a program card with Customize and Save buttons.${draft.unmatched.length ? ` Left out (not in the library): ${draft.unmatched.join(", ")}` : ""}`;
        } else [output, isError] = [`Error, nothing was shown: ${issues(p.error)}. Fix the input and call propose_program again.`, true];
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: output, ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: results });
  }

  // Several single-day routines in one answer become one program card,
  // so nothing is lost (only one card is shown per message)
  let proposal: CoachProposal | CoachProgramProposal | null = program;
  if (!proposal && routineProposals.length > 1) {
    proposal = {
      kind: "program",
      draft: {
        name: "Your new routines",
        summary: "",
        days: routineProposals.map((r) => ({ name: r.name, exercises: r.exercises })),
        unmatched: routineProposals.flatMap((r) => r.unmatched),
      },
    };
  } else if (!proposal && routineProposals.length === 1) proposal = routineProposals[0];

  // Never answer with an empty or misleading message
  if (!reply) {
    reply = proposal
      ? "Here it is. Tap Customize to change anything, or save it as is."
      : notesChanged.length
        ? "Got it, I'll keep that in mind."
        : "Sorry, I didn't manage to put an answer together. Could you ask that again?";
  }
  return { reply, proposal, notesChanged };
}

async function resolveProposal(
  userId: string,
  input: z.infer<typeof proposalInput>,
  routines: { id: string; name: string }[],
): Promise<CoachProposal> {
  const { exercises, unmatched } = await resolveExercises(userId, input.exercises);
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
