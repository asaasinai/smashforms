-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('PIN', 'HIGHLIGHT', 'DRAW');

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "title" TEXT,
    "vercelProjectId" TEXT,
    "githubRepo" TEXT,
    "repoFileTree" JSONB,
    "devEmail" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "type" "AnnotationType" NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "scrollY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewportWidth" INTEGER NOT NULL DEFAULT 1440,
    "viewportHeight" INTEGER NOT NULL DEFAULT 900,
    "elementSelector" TEXT,
    "comment" TEXT,
    "aiFollowups" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevSpec" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "specMarkdown" TEXT NOT NULL,
    "specJson" JSONB,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Annotation_reviewId_idx" ON "Annotation"("reviewId");

-- CreateIndex
CREATE INDEX "DevSpec_reviewId_idx" ON "DevSpec"("reviewId");

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevSpec" ADD CONSTRAINT "DevSpec_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
