-- CreateTable
CREATE TABLE "MusicLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "embedUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lastPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicLink_userId_idx" ON "MusicLink"("userId");

-- AddForeignKey
ALTER TABLE "MusicLink" ADD CONSTRAINT "MusicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
