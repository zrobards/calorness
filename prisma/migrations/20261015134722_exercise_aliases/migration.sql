-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
