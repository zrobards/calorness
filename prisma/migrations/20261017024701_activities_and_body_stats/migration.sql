-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthYear" INTEGER,
ADD COLUMN     "exerciseCredit" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "sex" TEXT;

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intensity" TEXT NOT NULL DEFAULT 'moderate',
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMin" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "inclinePct" DOUBLE PRECISION,
    "avgHeartRate" INTEGER,
    "caloriesTotal" INTEGER NOT NULL,
    "caloriesNet" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEntry_userId_date_idx" ON "ActivityEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
