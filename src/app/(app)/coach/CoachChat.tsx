"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Loader2, Sparkles, X } from "lucide-react";
import type { CoachProposal } from "@/lib/ai/coach";
import { haptic } from "@/lib/haptics";
import { applyProposal, clearCoachChat, forgetNote, sendCoachMessage } from "./actions";

type Msg = { id: string; role: "user" | "assistant"; content: string; proposal: CoachProposal | null };
type Note = { id: string; kind: string; text: string };

const STARTERS = [
  "My shoulder hurt during push day. Can you rework it?",
  "I've stalled on bench press. What should I change?",
  "Build me a 3-day plan for the gym I have",
  "How much protein should I eat to build muscle?",
];
const NOTE_COLOR: Record<string, string> = { injury: "bg-plate-red/15 text-plate-red", goal: "bg-plate-green/15 text-plate-green", preference: "bg-plate-blue/15 text-plate-blue" };

export function CoachChat({ initialMessages, notes }: { initialMessages: Msg[]; notes: Note[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [sending, startSend] = useTransition();
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  const send = (value: string) => {
    const msg = value.trim();
    if (!msg || sending) return;
    haptic();
    setText("");
    setError(null);
    setMessages((m) => [...m, { id: `local-${m.length}`, role: "user", content: msg, proposal: null }]);
    startSend(async () => {
      const r = await sendCoachMessage(msg);
      if ("error" in r && r.error) return setError(r.error);
      if ("reply" in r) {
        setMessages((m) => [...m, { id: r.id!, role: "assistant", content: r.reply!, proposal: r.proposal ?? null }]);
        if (r.notesChanged?.length) router.refresh(); // show the new "remembers" chips
      }
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <header className="sticky top-0 z-10 border-b border-rack-line bg-rack/95 px-5 pb-3 backdrop-blur" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <Sparkles size={22} className="text-plate-yellow" aria-hidden /> Coach
          </h1>
          {messages.length > 0 && (
            <button onClick={() => confirm("Clear this conversation? What Coach remembers stays.") && start(async () => { await clearCoachChat(); setMessages([]); })}
              className="text-sm text-chalk-muted">Clear chat</button>
          )}
        </div>
        {/* Everything Coach keeps in mind, visible and removable */}
        {notes.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="What Coach remembers">
            {notes.map((n) => (
              <span key={n.id} className={`flex shrink-0 items-center gap-1 rounded-full py-1 pr-1 pl-3 text-xs font-medium ${NOTE_COLOR[n.kind] ?? "bg-rack-raised text-chalk-muted"}`}>
                {n.text}
                <button onClick={() => start(() => forgetNote(n.id))} disabled={pending} className="rounded-full p-0.5 opacity-70 hover:opacity-100" aria-label={`Forget: ${n.text}`}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 space-y-3 px-4 py-4">
        {messages.length === 0 && (
          <div className="animate-rise px-1">
            <p className="text-chalk-muted">
              Tell Coach about pain, plateaus, or goals. It sees your routines and recent workouts, remembers what matters, and can rework a routine for you.
            </p>
            <div className="mt-4 space-y-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-2xl bg-rack-raised px-4 py-3 text-left text-sm">{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`animate-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${m.role === "user" ? "rounded-2xl rounded-br-md bg-plate-blue px-4 py-2.5 text-white" : "space-y-3"}`}>
              {m.role === "assistant" ? (
                <>
                  <div className="rounded-2xl rounded-bl-md bg-rack-raised px-4 py-2.5 leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  {m.proposal && m.proposal.exercises.length > 0 && (
                    <div className="rounded-2xl border border-plate-yellow/50 bg-rack-raised p-4">
                      <p className="font-display text-xl font-semibold">{m.proposal.name}</p>
                      {m.proposal.reason && <p className="mt-0.5 text-sm text-chalk-muted">{m.proposal.reason}</p>}
                      <ul className="mt-3 space-y-1 text-sm">
                        {m.proposal.exercises.map((e, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="truncate">{e.name}</span>
                            <span className="shrink-0 text-chalk-muted tabular-nums">{e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}</span>
                          </li>
                        ))}
                      </ul>
                      {applied[m.id] ? (
                        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-plate-green"><Check size={16} aria-hidden /> {applied[m.id]}</p>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {m.proposal.replacesRoutineId && (
                            <button disabled={pending} onClick={() => start(async () => {
                              const r = await applyProposal(m.id, "replace");
                              if (r.ok) { haptic("success"); setApplied((a) => ({ ...a, [m.id]: `Updated ${m.proposal!.replacesRoutineName}` })); }
                            })} className="rounded-xl bg-plate-red py-2.5 font-semibold text-white disabled:opacity-60">
                              Replace my {m.proposal.replacesRoutineName}
                            </button>
                          )}
                          <button disabled={pending} onClick={() => start(async () => {
                            const r = await applyProposal(m.id, "new");
                            if (r.ok) { haptic("success"); setApplied((a) => ({ ...a, [m.id]: `Saved "${m.proposal!.name}" to your routines` })); }
                          })} className={`rounded-xl py-2.5 font-semibold disabled:opacity-60 ${m.proposal.replacesRoutineId ? "bg-rack" : "bg-plate-red text-white"}`}>
                            Save as a new routine
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 px-1 text-sm text-chalk-muted" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Coach is thinking…
          </div>
        )}
        {error && <p role="alert" className="rounded-xl border border-plate-red/50 bg-plate-red/10 px-4 py-2 text-sm">{error}</p>}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(text); }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] flex items-end gap-2 border-t border-rack-line bg-rack px-4 py-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          rows={1}
          maxLength={1000}
          placeholder="Ask Coach anything"
          aria-label="Message Coach"
          className="max-h-32 flex-1 resize-none rounded-2xl border border-rack-line bg-rack-raised px-4 py-2.5 text-base focus:border-plate-yellow focus:outline-none"
        />
        <button disabled={sending || !text.trim()} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-plate-red text-white disabled:opacity-40" aria-label="Send">
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
