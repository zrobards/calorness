"use server";

import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { cleanModel, coachModel, textModel, visionModel } from "@/lib/ai/claude";


/** Owner tool: send a tiny request with each configured model and report which ones work. */
export async function checkAi() {
  const user = await requireUser();
  if (!isAdmin(user.email)) return [];
  const settings = [
    { name: "Photos and labels (AI_VISION_MODEL)", raw: process.env.AI_VISION_MODEL, model: visionModel() },
    { name: "Describe (AI_MODEL)", raw: process.env.AI_MODEL, model: textModel() },
    { name: "Coach (AI_COACH_MODEL)", raw: process.env.AI_COACH_MODEL, model: coachModel() },
  ];
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  return Promise.all(
    settings.map(async (s) => {
      // Test exactly what's typed in Vercel, so typos show up here instead of hiding behind the fallback
      const tested = s.raw ? s.raw : s.model;
      const ignored = !!s.raw && !cleanModel(s.raw);
      try {
        const res = await fetch(`${base}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: cleanModel(tested) ?? tested, max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }),
          signal: AbortSignal.timeout(20_000),
        });
        const detail = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 160);
        return { name: s.name, value: tested, inUse: s.model, ok: res.ok, status: res.status, detail, ignored };
      } catch {
        return { name: s.name, value: tested, inUse: s.model, ok: false, status: 0, detail: "No response", ignored };
      }
    }),
  );
}
