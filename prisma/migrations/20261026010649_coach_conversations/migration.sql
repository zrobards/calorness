-- AlterTable
ALTER TABLE "CoachMessage" ADD COLUMN     "conversationId" TEXT;

-- CreateTable
CREATE TABLE "CoachConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachConversation_userId_updatedAt_idx" ON "CoachConversation"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "CoachConversation" ADD CONSTRAINT "CoachConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CoachConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Put each person's existing Coach messages into one "Earlier chat" so nothing is lost
INSERT INTO "CoachConversation" ("id", "userId", "title", "createdAt", "updatedAt")
SELECT 'earlier-' || "userId", "userId", 'Earlier chat', MIN("createdAt"), MAX("createdAt")
FROM "CoachMessage" GROUP BY "userId";
UPDATE "CoachMessage" SET "conversationId" = 'earlier-' || "userId" WHERE "conversationId" IS NULL;
