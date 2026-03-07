import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Create tables matching the Prisma schema
    await prisma.$executeRawUnsafe(`
      CREATE TYPE IF NOT EXISTS "ReviewStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUBMITTED', 'COMPLETED');
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
      CREATE TABLE IF NOT EXISTS "Screenshot" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "reviewId" TEXT NOT NULL,
        "imageData" TEXT NOT NULL,
        "notes" TEXT,
        "conversation" JSONB,
        "lockedSpec" TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Screenshot_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE
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
