import { ReviewStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const submitWebhookSchema = z.object({
  reviewId: z.string().min(1).optional(),
  id: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reviewId = parsed.data.reviewId ?? parsed.data.id;

    if (!reviewId) {
      return NextResponse.json(
        { error: "reviewId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.SUBMITTED }
    });

    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    console.error("Failed to submit review webhook", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
