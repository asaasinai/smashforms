import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Create tables matching the Prisma schema
    await prisma.$executeRawUnsafe(`
      CREATE TYPE IF NOT EXISTS "ReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SUBMITTED', 'COMPLETED');
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TYPE IF NOT EXISTS "AnnotationType" AS ENUM ('PIN', 'HIGHLIGHT', 'DRAW');
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Review" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "targetUrl" TEXT NOT NULL,
        "vercelProjectId" TEXT,
        "githubRepo" TEXT,
        "repoFileTree" JSONB,
        "devEmail" TEXT,
        "title" TEXT,
        "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Annotation" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "reviewId" TEXT NOT NULL,
        "type" "AnnotationType" NOT NULL,
        "positionX" DOUBLE PRECISION NOT NULL,
        "positionY" DOUBLE PRECISION NOT NULL,
        "scrollY" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "viewportWidth" INTEGER,
        "viewportHeight" INTEGER,
        "elementSelector" TEXT,
        "comment" TEXT,
        "aiFollowups" JSONB,
        "drawData" JSONB,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Annotation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DevSpec" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "reviewId" TEXT NOT NULL,
        "specMarkdown" TEXT NOT NULL,
        "specJson" JSONB,
        "emailedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DevSpec_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DevSpec_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    // Verify tables exist
    const tables = await prisma.$queryRawUnsafe<Array<{tablename: string}>>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );

    return NextResponse.json({
      success: true,
      tables: tables.map((t) => t.tablename),
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
