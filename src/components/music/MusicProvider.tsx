"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, ListMusic, Music2, Plus, Trash2, X } from "lucide-react";
import { SERVICE_LABEL, type MusicService } from "@/lib/music";
import { addMusic, listMusic, markPlayed, removeMusic, type SavedMusic } from "@/app/(app)/music/actions";
import { haptic } from "@/lib/haptics";
import { Sheet } from "@/components/diary/Sheet";

// Music lives in the app layout, which stays mounted while you move between
// tabs, so a playlist keeps playing from Train to Diary and back. Each
// service plays in its own official embedded player.

type Ctx = { current: SavedMusic | null; openLibrary: () => void };
const MusicContext = createContext<Ctx>({ current: null, openLibrary: () => {} });
export const useMusic = () => useContext(MusicContext);

const STORE = "calorness:music:v1";
const SERVICE_COLOR: Record<MusicService, string> = { youtube: "bg-plate-red", spotify: "bg-plate-green", apple: "bg-plate-blue", soundcloud: "bg-plate-yellow" };
// Height of each service's compact player
const MINI_HEIGHT: Record<MusicService, number> = { youtube: 200, spotify: 80, apple: 175, soundcloud: 166 };

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<SavedMusic | null>(null);
  const [library, setLibrary] = useState(false);
  const [mini, setMini] = useState(true);

  // Bring back what was playing (paused; browsers won't autoplay on load)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as { current: SavedMusic; mini: boolean } | null;
      if (saved?.current) {
        const t = setTimeout(() => { setCurrent(saved.current); setMini(saved.mini); }, 0);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(current ? { current, mini } : null));
    } catch {}
  }, [current, mini]);

  const play = useCallback((m: SavedMusic) => {
    haptic();
    setCurrent(m);
    setLibrary(false);
    markPlayed(m.id).catch(() => {});
  }, []);

  return (
    <MusicContext.Provider value={{ current, openLibrary: () => setLibrary(true) }}>
      {children}
      {current && <MusicDock music={current} mini={mini} setMini={setMini} onClose={() => setCurrent(null)} onLibrary={() => setLibrary(true)} />}
      {library && <MusicLibrary current={current} onPlay={play} onClose={() => setLibrary(false)} />}
    </MusicContext.Provider>
  );
}

/** A small button for headers: opens the music library. */
export function MusicButton({ className = "" }: { className?: string }) {
  const { current, openLibrary } = useMusic();
  return (
    <button onClick={openLibrary} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium ${current ? "text-plate-green" : "text-chalk-muted"} ${className}`} aria-label="Music">
      <Music2 size={18} aria-hidden /> Music
    </button>
  );
}

function MusicDock({ music, mini, setMini, onClose, onLibrary }: {
  music: SavedMusic;
  mini: boolean;
  setMini: (m: boolean) => void;
  onClose: () => void;
  onLibrary: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Tell the rest of the page how tall the player is, so the rest timer and
  // page content can sit above it
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--music-dock-h", `${el.offsetHeight + 8}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--music-dock-h", "0px");
    };
  }, []);

  const youtube = music.service === "youtube";
  // YouTube's player has to stay visible and at least 200×200, so its mini
  // size is a square tile; the others have their own compact players.
  const frameStyle: React.CSSProperties = mini
    ? youtube ? { width: 200, height: 200 } : { width: "100%", height: MINI_HEIGHT[music.service] }
    : youtube ? { width: "100%", aspectRatio: "16 / 9" } : { width: "100%", height: music.service === "spotify" ? 352 : 175 };

  return (
    <div ref={ref} className="vv-pin fixed inset-x-0 z-30 px-3" style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}>
      <div className={`overflow-hidden rounded-2xl border border-rack-line bg-rack-raised shadow-2xl ${mini && youtube ? "ml-auto w-[200px]" : "mx-auto max-w-md"}`}>
        <div className="flex items-center gap-1 px-2 py-1.5">
          <span className={`size-2 shrink-0 rounded-full ${SERVICE_COLOR[music.service]}`} aria-hidden />
          <span className="min-w-0 flex-1 truncate px-1 text-xs font-medium" title={music.title}>{music.title}</span>
          <button onClick={onLibrary} className="p-1 text-chalk-muted" aria-label="Music library"><ListMusic size={16} /></button>
          <button onClick={() => setMini(!mini)} className="p-1 text-chalk-muted" aria-label={mini ? "Bigger player" : "Smaller player"}>
            {mini ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={onClose} className="p-1 text-chalk-muted" aria-label="Stop music"><X size={16} /></button>
        </div>
        {/* The same iframe in both sizes, so resizing never restarts the music */}
        <iframe
          key={music.embedUrl}
          src={music.embedUrl}
          title={`${SERVICE_LABEL[music.service]}: ${music.title}`}
          style={{ ...frameStyle, border: 0, display: "block" }}
          allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
          loading="eager"
        />
      </div>
    </div>
  );
}

function MusicLibrary({ current, onPlay, onClose }: { current: SavedMusic | null; onPlay: (m: SavedMusic) => void; onClose: () => void }) {
  const [items, setItems] = useState<SavedMusic[] | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    listMusic().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <Sheet title="Music" onClose={onClose}>
      <p className="mt-1 text-sm text-chalk-muted">Play your playlists without leaving the app. It keeps playing as you switch tabs.</p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await addMusic(link);
            if ("error" in r && r.error) return setError(r.error);
            if ("music" in r && r.music) {
              setLink("");
              setItems((list) => [r.music!, ...(list ?? []).filter((m) => m.id !== r.music!.id)]);
              onPlay(r.music);
            }
          });
        }}
      >
        <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="Paste a playlist or song link" aria-label="Music link"
          className="min-w-0 flex-1 rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base focus:border-plate-yellow focus:outline-none" />
        <button disabled={pending || !link.trim()} className="flex items-center gap-1 rounded-xl bg-plate-red px-4 font-semibold text-white disabled:opacity-50">
          <Plus size={18} aria-hidden /> {pending ? "…" : "Add"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-plate-red">{error}</p>}

      <ul className="mt-4 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack">
        {items === null && <li className="p-4 text-sm text-chalk-muted">Loading…</li>}
        {items?.length === 0 && <li className="p-4 text-sm text-chalk-muted">No music yet. Paste a link above.</li>}
        {items?.map((m) => (
          <li key={m.id} className="flex items-center">
            <button onClick={() => onPlay(m)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
              <span className={`size-2.5 shrink-0 rounded-full ${SERVICE_COLOR[m.service]}`} aria-hidden />
              <span className="min-w-0">
                <span className={`block truncate font-medium ${current?.id === m.id ? "text-plate-green" : ""}`}>{m.title}</span>
                <span className="text-xs text-chalk-muted">{SERVICE_LABEL[m.service]}{current?.id === m.id ? ", playing" : ""}</span>
              </span>
            </button>
            <button onClick={() => start(async () => { await removeMusic(m.id); setItems((l) => l?.filter((x) => x.id !== m.id) ?? null); })}
              className="p-3 text-chalk-muted hover:text-plate-red" aria-label={`Remove ${m.title}`}>
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <details className="mt-4 text-sm text-chalk-muted">
        <summary className="cursor-pointer font-medium text-chalk">How to get a link</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li><b>YouTube Music:</b> open a playlist, album, or song, tap <b>Share</b>, then <b>Copy link</b>. Private playlists (including Liked Music) can&apos;t play outside YouTube; set the playlist to Unlisted or Public. Ads may play unless you&apos;re signed in to YouTube Premium in this browser.</li>
          <li><b>Spotify</b> and <b>Apple Music:</b> Share, then Copy link. Full songs play if you&apos;re signed in to that service in this browser; otherwise 30-second previews.</li>
          <li><b>SoundCloud:</b> Share, then Copy link. Full tracks play.</li>
          <li>Music plays while the app is open. During a workout the screen stays on, so it keeps going between sets.</li>
        </ul>
      </details>
    </Sheet>
  );
}
