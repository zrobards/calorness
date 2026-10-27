// one-off check: how the user's program names resolve against the library
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rows = await db.exercise.findMany({ where: { createdById: null }, select: { name: true, aliases: true } });
console.log(JSON.stringify(rows));
await db.$disconnect();
