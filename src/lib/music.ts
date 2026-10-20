// Turns a link copied from a music app into something Calorness can play in
// an embedded player: YouTube / YouTube Music, Spotify, Apple Music, SoundCloud.
// Each service's own embedded player is used, which is what their terms allow.

export type MusicService = "youtube" | "spotify" | "apple" | "soundcloud";
export type ParsedMusic = { service: MusicService; kind: string; url: string; embedUrl: string };

export const SERVICE_LABEL: Record<MusicService, string> = {
  youtube: "YouTube Music",
  spotify: "Spotify",
  apple: "Apple Music",
  soundcloud: "SoundCloud",
};

const YT_PARAMS = "playsinline=1&rel=0&modestbranding=1";

export function parseMusicLink(input: string): ParsedMusic | null {
  let u: URL;
  try {
    u = new URL(input.trim().replace(/^(?!https?:\/\/)/, "https://"));
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");

  // YouTube and YouTube Music share ids, and both play in YouTube's player
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
    const list = u.searchParams.get("list");
    const video = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v");
    const clean = (s: string | null) => (s && /^[\w-]{6,64}$/.test(s) ? s : null);
    const l = clean(list), v = clean(video);
    if (v && l) return { service: "youtube", kind: "playlist", url: u.toString(), embedUrl: `https://www.youtube.com/embed/${v}?list=${l}&${YT_PARAMS}` };
    if (l) return { service: "youtube", kind: "playlist", url: u.toString(), embedUrl: `https://www.youtube.com/embed/videoseries?list=${l}&${YT_PARAMS}` };
    if (v) return { service: "youtube", kind: "song", url: u.toString(), embedUrl: `https://www.youtube.com/embed/${v}?${YT_PARAMS}` };
    return null;
  }

  if (host === "open.spotify.com") {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|episode|show)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return { service: "spotify", kind: m[1], url: `https://open.spotify.com/${m[1]}/${m[2]}`, embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
  }

  if (host === "music.apple.com") {
    if (!/^\/[a-z]{2}\/(album|playlist|song|station)\//.test(u.pathname)) return null;
    return { service: "apple", kind: u.pathname.split("/")[2], url: u.toString(), embedUrl: `https://embed.music.apple.com${u.pathname}${u.search}` };
  }

  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    if (u.pathname.split("/").filter(Boolean).length < 1) return null;
    return { service: "soundcloud", kind: "track", url: u.toString(), embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&visual=false&show_comments=false` };
  }
  return null;
}
