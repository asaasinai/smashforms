import { ReviewStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createReviewSchema = z.object({
  targetUrl: z.string().url(),
  devEmail: z.string().email().optional(),
  title: z.string().min(1).max(200).optional()
});

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ reviews }, { status: 200 });
  } catch (error) {
    console.error("Failed to list reviews", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const review = await prisma.review.create({
      data: {
        targetUrl: parsed.data.targetUrl,
        devEmail: parsed.data.devEmail,
        title: parsed.data.title,
        status: ReviewStatus.DRAFT
      }
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Failed to create review", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
