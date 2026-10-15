-- CreateTable
CREATE TABLE "SearchPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchPick_userId_idx" ON "SearchPick"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchPick_userId_query_foodId_key" ON "SearchPick"("userId", "query", "foodId");

-- AddForeignKey
ALTER TABLE "SearchPick" ADD CONSTRAINT "SearchPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPick" ADD CONSTRAINT "SearchPick_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
