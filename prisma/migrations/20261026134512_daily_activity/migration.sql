-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeCalGoal" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "exerciseMinGoal" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "stepGoal" INTEGER NOT NULL DEFAULT 8000,
ADD COLUMN     "useHealthCalories" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "activeCalories" INTEGER,
    "exerciseMinutes" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "walkingSpeedMps" DOUBLE PRECISION,
    "flights" INTEGER,
    "restingHr" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'apple-health',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_userId_date_key" ON "DailyActivity"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
