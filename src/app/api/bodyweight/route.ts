import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { plainText, userFromApiKey } from "@/lib/apiAuth";
import { lbToKg } from "@/lib/fitness/units";
import { dayInZone } from "@/lib/time";

/*
  POST /api/bodyweight : record a weigh-in from outside the app, e.g. an
  iPhone Automation that reads your latest weight from Apple Health each morning.

  Authorization: Bearer cal_…
  Body (form or JSON): weight=176.4, unit=lb|kg (optional, defaults to your units), day=YYYY-MM-DD (optional)
*/
export async function POST(req: Request) {
  const user = await userFromApiKey(req);
  if (!user) return plainText("That Calorness key isn't valid. Make a new one in Profile.", 401);

  let raw: Record<string, unknown> = {};
  try {
    const type = (req.headers.get("content-type") ?? "").toLowerCase();
    raw = type.includes("json") ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return plainText("Couldn't read what the shortcut sent.", 400);
  }

  const parsed = z
    .object({
      // Health sometimes sends "176.4 lb" as one string; take the number out of it
      weight: z.preprocess((v) => (typeof v === "string" ? parseFloat(v.replace(",", ".")) : v), z.number().positive().max(700)),
      unit: z.preprocess((v) => (typeof v === "string" ? v.toLowerCase().replace(/s$/, "").replace("pound", "lb").replace("kilogram", "kg") : v), z.enum(["lb", "kg"]).optional()),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return plainText("Send a weight, like weight=176.4", 400);

  const unit = parsed.data.unit ?? (user.unitSystem === "IMPERIAL" ? "lb" : "kg");
  const weightKg = unit === "lb" ? lbToKg(parsed.data.weight) : parsed.data.weight;
  const day = parsed.data.day ?? dayInZone(new Date(), user.timeZone);
  const date = new Date(`${day}T00:00:00Z`);

  await db.bodyweightEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { weightKg },
    create: { userId: user.id, date, weightKg },
  });
  revalidatePath("/progress");
  return plainText(`Logged ${Math.round(parsed.data.weight * 10) / 10} ${unit} for ${day}.`);
}
