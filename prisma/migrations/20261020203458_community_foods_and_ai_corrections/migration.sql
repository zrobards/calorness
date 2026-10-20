-- AlterEnum
ALTER TYPE "FoodSource" ADD VALUE 'COMMUNITY';

-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "confirmations" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FoodSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "servingLabel" TEXT,
    "servingSize" DOUBLE PRECISION NOT NULL,
    "servingUnit" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "aiCalories" DOUBLE PRECISION NOT NULL,
    "finalCalories" DOUBLE PRECISION NOT NULL,
    "aiProteinG" DOUBLE PRECISION NOT NULL,
    "finalProteinG" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSubmission_key_idx" ON "FoodSubmission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSubmission_userId_key_key" ON "FoodSubmission"("userId", "key");

-- CreateIndex
CREATE INDEX "AiCorrection_key_idx" ON "AiCorrection"("key");

-- AddForeignKey
ALTER TABLE "FoodSubmission" ADD CONSTRAINT "FoodSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCorrection" ADD CONSTRAINT "AiCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
