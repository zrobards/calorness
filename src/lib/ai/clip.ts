import { z } from "zod";

/**
 * Text from the AI, shortened to fit instead of rejected. The AI sometimes
 * writes a longer description than we asked for ("1 bowl with white rice,
 * black beans, chicken, …"); refusing the whole answer over that made
 * logging fail for no good reason. Cuts at a word and adds "…".
 */
export function shorten(text: string, max: number) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:(-]+$/, "")}…`;
}

export const clip = (max: number) => z.string().transform((s) => shorten(s, max));
/** Same, but there has to be something there */
export const clipRequired = (max: number) => z.string().trim().min(1).transform((s) => shorten(s, max));
