"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, History, PenLine, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { CoachProgramProposal, CoachProposal } from "@/lib/ai/coach";
import { haptic } from "@/lib/haptics";
import { Markdown } from "@/components/Markdown";
import { Sheet } from "@/components/diary/Sheet";
import { applyProposal, deleteChat, forgetNote, listChats, saveCoachProgram, sendCoachMessage, type ChatSummary } from "./actions";

type Proposal = CoachProposal | CoachProgramProposal;
type Msg = { id: string; role: "user" | "assistant"; content: string; proposal: Proposal | null };
type Note = { id: string; kind: string; text: string };

const STARTERS = [
  "Build me a 4-day program for the gym I have",
  "My shoulder hurt during push day. Can you rework it?",
  "I've stalled on bench press. What should I change?",
  "How much protein should I eat to build muscle?",
];
const NOTE_COLOR: Record<string, string> = { injury: "bg-plate-red/15 text-plate-red", goal: "bg-plate-green/15 text-plate-green", preference: "bg-plate-blue/15 text-plate-blue" };
const isProgram = (p: Proposal): p is CoachProgramProposal => "kind" in p && p.kind === "program";

export function CoachChat({ chat, initialMessages, notes }: { chat: { id: string; title: string } | null; initialMessages: Msg[]; notes: Note[] }) {
  const router = useRouter();
  const [chatId, setChatId] = useState(chat?.id ?? null);
  const [title, setTitle] = useState(chat?.title ?? "New chat");
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [showChats, setShowChats] = useState(false);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  const send = async (value: string) => {
    const msg = value.trim();
    if (!msg || sending) return;
    haptic();
    setText("");
    setError(null);
    setSending(true); // set outside a transition so the typing dots show right away
    setMessages((m) => [...m, { id: `local-${m.length}`, role: "user", content: msg, proposal: null }]);
    if (!chatId) setTitle(msg.slice(0, 60));
    const r = await sendCoachMessage(msg, chatId).catch(() => ({ error: "Couldn't reach Coach. Check your connection." }) as { error: string; conversationId?: string });
    setSending(false);
    if ("conversationId" in r && r.conversationId && r.conversationId !== chatId) {
      setChatId(r.conversationId);
      window.history.replaceState(null, "", `/coach?c=${r.conversationId}`); // a refresh reopens this chat
    }
    if ("error" in r && r.error) return setError(r.error);
    if ("reply" in r && r.reply) {
      haptic("success");
      setMessages((m) => [...m, { id: r.id!, role: "assistant", content: r.reply!, proposal: (r.proposal as Proposal) ?? null }]);
      if (r.notesChanged?.length) router.refresh();
    }
  };

  const openChats = () => {
    setShowChats(true);
    listChats().then(setChats).catch(() => setChats([]));
  };

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <header className="sticky top-0 z-10 border-b border-rack-line bg-rack/95 px-4 pb-3 backdrop-blur" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="shrink-0 text-plate-yellow" aria-hidden />
          <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold tracking-tight">{messages.length ? title : "Coach"}</h1>
          <button onClick={openChats} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-chalk-muted" aria-label="Past chats">
            <History size={18} aria-hidden /> Chats
          </button>
          <Link href="/coach?new=1" className="flex items-center gap-1 rounded-lg bg-rack-raised px-2.5 py-1.5 text-sm font-medium" aria-label="New chat">
            <PenLine size={16} aria-hidden /> New
          </Link>
        </div>
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
              Ask about training, food, pain, or plateaus. Coach sees your routines and recent workouts, remembers what matters, and can build or rework programs you can customize.
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
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-plate-blue px-4 py-2.5 whitespace-pre-wrap text-white">{m.content}</div>
            ) : (
              <div className="max-w-[90%] space-y-3">
                <div className="rounded-2xl rounded-bl-md bg-rack-raised px-4 py-3 leading-relaxed">
                  <Markdown text={m.content} />
                </div>
                {m.proposal && isProgram(m.proposal) && m.proposal.draft.days.length > 0 && (
                  <ProgramCard messageId={m.id} draft={m.proposal.draft} saved={applied[m.id]} onSaved={(label) => setApplied((a) => ({ ...a, [m.id]: label }))} />
                )}
                {m.proposal && !isProgram(m.proposal) && m.proposal.exercises.length > 0 && (
                  <RoutineCard
                    messageId={m.id}
                    proposal={m.proposal}
                    applied={applied[m.id]}
                    pending={pending}
                    onApply={(mode) => start(async () => {
                      const r = await applyProposal(m.id, mode);
                      if (r.ok) {
                        haptic("success");
                        const p = m.proposal as CoachProposal;
                        setApplied((a) => ({ ...a, [m.id]: mode === "replace" ? `Updated ${p.replacesRoutineName}` : `Saved "${p.name}" to your routines` }));
                      }
                    })}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex justify-start" role="status" aria-label="Coach is typing">
            <div className="flex gap-1.5 rounded-2xl rounded-bl-md bg-rack-raised px-4 py-3.5">
              {[0, 1, 2].map((i) => <span key={i} className="typing-dot size-2 rounded-full bg-chalk-muted" style={{ animationDelay: `${i * 160}ms` }} />)}
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl border border-plate-red/50 bg-plate-red/10 px-4 py-2 text-sm">{error}</p>}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(text); }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem+var(--music-dock-h,0px))] flex items-end gap-2 border-t border-rack-line bg-rack px-4 py-3"
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

      {showChats && (
        <Sheet title="Your chats" onClose={() => setShowChats(false)}>
          <Link href="/coach?new=1" onClick={() => setShowChats(false)} className="mt-3 flex items-center gap-2 rounded-xl bg-plate-red px-4 py-3 font-semibold text-white">
            <Plus size={18} aria-hidden /> New chat
          </Link>
          <ul className="mt-3 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack">
            {chats === null && <li className="p-4 text-sm text-chalk-muted">Loading…</li>}
            {chats?.length === 0 && <li className="p-4 text-sm text-chalk-muted">No chats yet.</li>}
            {chats?.map((c) => (
              <li key={c.id} className={`flex items-center ${c.id === chatId ? "bg-plate-blue/10" : ""}`}>
                <Link href={`/coach?c=${c.id}`} onClick={() => setShowChats(false)} className="min-w-0 flex-1 px-4 py-3">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="block truncate text-xs text-chalk-muted">
                    {new Date(c.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {c.preview}
                  </span>
                </Link>
                <button
                  onClick={() => confirm(`Delete "${c.title}"?`) && start(async () => {
                    await deleteChat(c.id);
                    setChats((list) => list?.filter((x) => x.id !== c.id) ?? null);
                    if (c.id === chatId) router.push("/coach?new=1");
                  })}
                  className="p-3 text-chalk-muted hover:text-plate-red" aria-label={`Delete ${c.title}`}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}

function RoutineCard({ messageId, proposal, applied, pending, onApply }: { messageId: string; proposal: CoachProposal; applied?: string; pending: boolean; onApply: (mode: "replace" | "new") => void }) {
  return (
    <div className="rounded-2xl border border-plate-yellow/50 bg-rack-raised p-4" data-message={messageId}>
      <p className="font-display text-xl font-semibold">{proposal.name}</p>
      {proposal.reason && <p className="mt-0.5 text-sm text-chalk-muted">{proposal.reason}</p>}
      <ul className="mt-3 space-y-1 text-sm">
        {proposal.exercises.map((e, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="truncate">{e.name}</span>
            <span className="shrink-0 text-chalk-muted tabular-nums">{e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}</span>
          </li>
        ))}
      </ul>
      {applied ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-plate-green"><Check size={16} aria-hidden /> {applied}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {proposal.replacesRoutineId && (
            <button disabled={pending} onClick={() => onApply("replace")} className="rounded-xl bg-plate-red py-2.5 font-semibold text-white disabled:opacity-60">
              Replace my {proposal.replacesRoutineName}
            </button>
          )}
          <button disabled={pending} onClick={() => onApply("new")} className={`rounded-xl py-2.5 font-semibold disabled:opacity-60 ${proposal.replacesRoutineId ? "bg-rack" : "bg-plate-red text-white"}`}>
            Save as a new routine
          </button>
        </div>
      )}
    </div>
  );
}

function ProgramCard({ messageId, draft, saved, onSaved }: { messageId: string; draft: CoachProgramProposal["draft"]; saved?: string; onSaved: (label: string) => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border border-plate-yellow/50 bg-rack-raised p-4">
      <p className="font-display text-xl font-semibold">{draft.name}</p>
      {draft.summary && <p className="mt-0.5 text-sm text-chalk-muted">{draft.summary}</p>}
      <ul className="mt-3 space-y-2 text-sm">
        {draft.days.map((d) => (
          <li key={d.name} className="rounded-xl bg-rack px-3 py-2">
            <span className="font-semibold">{d.name}</span>
            <span className="text-chalk-muted">{d.exercises.length ? `: ${d.exercises.length} exercises, ${d.exercises.reduce((s, e) => s + e.sets, 0)} sets` : ""}</span>
            {d.activity && <span className="block truncate text-xs font-semibold text-plate-green">{d.activity}</span>}
            <span className="block truncate text-xs text-chalk-muted">{d.exercises.map((e) => e.name).join(", ")}</span>
          </li>
        ))}
      </ul>
      {saved ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-plate-green"><Check size={16} aria-hidden /> {saved}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href={`/train/programs/build?from=${messageId}`} className="rounded-xl bg-plate-red py-2.5 text-center font-semibold text-white">Customize</Link>
          <button disabled={pending} onClick={() => start(async () => { const r = await saveCoachProgram(messageId); if (r.ok) { haptic("success"); onSaved(`Saved ${draft.days.length} routines`); } })}
            className="rounded-xl bg-rack py-2.5 font-semibold disabled:opacity-60">
            {pending ? "Saving…" : "Save as is"}
          </button>
        </div>
      )}
    </div>
  );
}
