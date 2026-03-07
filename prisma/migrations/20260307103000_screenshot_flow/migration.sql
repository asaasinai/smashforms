-- Drop legacy annotation table and enum
DROP TABLE IF EXISTS "Annotation";
DROP TYPE IF EXISTS "AnnotationType";

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "notes" TEXT,
    "conversation" JSONB,
    "lockedSpec" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Screenshot_reviewId_idx" ON "Screenshot"("reviewId");

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
