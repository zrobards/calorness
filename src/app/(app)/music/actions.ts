"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMusicLink, SERVICE_LABEL, type MusicService } from "@/lib/music";

export type SavedMusic = { id: string; service: MusicService; title: string; embedUrl: string; url: string };
const toSaved = (m: { id: string; service: string; title: string; embedUrl: string; url: string }): SavedMusic => ({ ...m, service: m.service as MusicService });

export async function listMusic(): Promise<SavedMusic[]> {
  const user = await requireUser();
  const rows = await db.musicLink.findMany({
    where: { userId: user.id },
    orderBy: [{ lastPlayedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map(toSaved);
}

/** The service's public oEmbed endpoint gives us the playlist or song name. */
async function lookupTitle(service: MusicService, url: string): Promise<string | null> {
  const endpoint = {
    youtube: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.replace("music.youtube.com", "www.youtube.com"))}`,
    spotify: `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    soundcloud: `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    apple: null,
  }[service];
  if (!endpoint) {
    // Apple Music links carry the name in the path: /us/playlist/pure-workout/pl.123
    const slug = new URL(url).pathname.split("/")[3];
    return slug ? decodeURIComponent(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  }
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string };
    return j.title?.slice(0, 120) || null;
  } catch {
    return null;
  }
}

export async function addMusic(link: string, title?: string) {
  const user = await requireUser();
  const text = z.string().trim().min(5).max(500).safeParse(link);
  if (!text.success) return { error: "Paste a link from YouTube Music, Spotify, Apple Music, or SoundCloud." };
  const parsed = parseMusicLink(text.data);
  if (!parsed) return { error: "That link isn't a playlist, album, or song from YouTube Music, Spotify, Apple Music, or SoundCloud." };

  const existing = await db.musicLink.findFirst({ where: { userId: user.id, embedUrl: parsed.embedUrl } });
  if (existing) return { music: toSaved(existing) };
  const name = title?.trim() || (await lookupTitle(parsed.service, parsed.url)) || `${SERVICE_LABEL[parsed.service]} ${parsed.kind}`;
  const row = await db.musicLink.create({
    data: { userId: user.id, service: parsed.service, url: parsed.url, embedUrl: parsed.embedUrl, title: name },
  });
  return { music: toSaved(row) };
}

export async function removeMusic(id: string) {
  const user = await requireUser();
  await db.musicLink.deleteMany({ where: { id, userId: user.id } });
}

export async function markPlayed(id: string) {
  const user = await requireUser();
  await db.musicLink.updateMany({ where: { id, userId: user.id }, data: { lastPlayedAt: new Date() } });
}
