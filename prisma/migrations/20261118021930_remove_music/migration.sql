/*
  Warnings:

  - You are about to drop the `MusicLink` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MusicLink" DROP CONSTRAINT "MusicLink_userId_fkey";

-- DropTable
DROP TABLE "MusicLink";
