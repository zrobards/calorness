"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toKg } from "@/lib/fitness/units";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const MAX_PHOTOS = 2000;

const refresh = () => {
  revalidatePath("/progress/photos");
  revalidatePath("/progress/calendar");
  revalidatePath("/progress");
};

/** A JPEG the phone already resized. Checked so nothing else gets stored. */
function jpeg(base64: string, maxBytes: number) {
  const buf = Buffer.from(base64, "base64");
  if (buf.length < 100 || buf.length > maxBytes) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // JPEG files start FF D8
  return buf;
}

const photoInput = z.object({
  day,
  image: z.string().max(2_000_000),
  thumb: z.string().max(300_000),
  width: z.number().int().min(50).max(4000),
  height: z.number().int().min(50).max(4000),
  visibility: z.enum(["PRIVATE", "FOLLOWERS"]),
  note: z.string().trim().max(200).optional(),
  weight: z.number().positive().max(700).nullable().optional(),
});

export async function addProgressPhoto(input: z.input<typeof photoInput>) {
  const user = await requireUser();
  const p = photoInput.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Couldn't read that photo." };
  const image = jpeg(p.data.image, 1_400_000);
  const thumb = jpeg(p.data.thumb, 200_000);
  if (!image || !thumb) return { error: "Couldn't read that photo. Try another one." };
  if ((await db.progressPhoto.count({ where: { userId: user.id } })) >= MAX_PHOTOS) return { error: "You've reached the photo limit. Delete a few old ones first." };
  const date = new Date(`${p.data.day}T00:00:00Z`);
  const photo = await db.progressPhoto.create({
    data: { userId: user.id, day: date, image, thumb, width: p.data.width, height: p.data.height, visibility: p.data.visibility, note: p.data.note || null },
    select: { id: true },
  });
  // A weight with the photo is that day's weigh-in
  if (p.data.weight) await saveWeight(user.id, date, p.data.weight);
  refresh();
  return { ok: true as const, id: photo.id };
}

export async function setPhotoVisibility(id: string, visibility: "PRIVATE" | "FOLLOWERS") {
  const user = await requireUser();
  await db.progressPhoto.updateMany({ where: { id: z.string().min(1).parse(id), userId: user.id }, data: { visibility: z.enum(["PRIVATE", "FOLLOWERS"]).parse(visibility) } });
  refresh();
  return { ok: true as const };
}

export async function deleteProgressPhoto(id: string) {
  const user = await requireUser();
  await db.progressPhoto.deleteMany({ where: { id: z.string().min(1).parse(id), userId: user.id } });
  refresh();
  return { ok: true as const };
}

async function saveWeight(userId: string, date: Date, weight: number) {
  const { unitSystem } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true } });
  const weightKg = toKg(weight, unitSystem);
  await db.bodyweightEntry.upsert({ where: { userId_date: { userId, date } }, update: { weightKg }, create: { userId, date, weightKg } });
}

/** Log or change the weigh-in for any day (in your units). */
export async function saveWeighIn(input: { day: string; weight: number }) {
  const user = await requireUser();
  const p = z.object({ day, weight: z.number().positive("Enter a weight.").max(700) }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Enter a weight." };
  await saveWeight(user.id, new Date(`${p.data.day}T00:00:00Z`), p.data.weight);
  refresh();
  return { ok: true as const };
}

export async function deleteWeighIn(dayStr: string) {
  const user = await requireUser();
  await db.bodyweightEntry.deleteMany({ where: { userId: user.id, date: new Date(`${day.parse(dayStr)}T00:00:00Z`) } });
  refresh();
  return { ok: true as const };
}
