-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "programId" TEXT;

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Program_userId_position_idx" ON "Program"("userId", "position");

-- CreateIndex
CREATE INDEX "Routine_programId_position_idx" ON "Routine"("programId", "position");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Group existing routines into programs, using the note each one was saved
-- with: 'From your program "Climb Strong"' (AI builder / Coach) or
-- 'From the Push / Pull / Legs program' (ready-made programs).
WITH named AS (
  SELECT r."id", r."userId",
         COALESCE(
           (regexp_match(r."notes", 'From your program "([^"]+)"'))[1],
           (regexp_match(r."notes", 'From the (.+) program'))[1]
         ) AS program_name
  FROM "Routine" r
),
groups AS (
  SELECT DISTINCT "userId", program_name FROM named WHERE program_name IS NOT NULL
)
INSERT INTO "Program" ("id", "userId", "name", "position", "createdAt", "updatedAt")
SELECT 'p-' || md5("userId" || program_name), "userId", program_name,
       ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY program_name) - 1, NOW(), NOW()
FROM groups;

UPDATE "Routine" r SET "programId" = 'p-' || md5(r."userId" || n.program_name)
FROM (
  SELECT "id", COALESCE(
           (regexp_match("notes", 'From your program "([^"]+)"'))[1],
           (regexp_match("notes", 'From the (.+) program'))[1]) AS program_name
  FROM "Routine"
) n
WHERE r."id" = n."id" AND n.program_name IS NOT NULL;

-- Start each person with their newest program switched on (usually the one
-- they just built), so the Train screen isn't empty after the update
UPDATE "Program" p SET "pinned" = true
FROM (
  SELECT DISTINCT ON (pr."userId") pr."id"
  FROM "Program" pr
  JOIN "Routine" r ON r."programId" = pr."id"
  ORDER BY pr."userId", r."createdAt" DESC
) newest
WHERE p."id" = newest."id";
