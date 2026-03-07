import { ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchReviewSchema = z
  .object({
    status: z.nativeEnum(ReviewStatus).optional(),
    title: z.string().min(1).max(200).optional(),
    devEmail: z.string().email().nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

type RouteContext = {
  params: { id: string };
};

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const review = await prisma.review.findUnique({
      where: { id: params.id },
      include: {
        annotations: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch review", error);
    return NextResponse.json({ error: "Failed to fetch review" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const parsed = patchReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.review.findUnique({
      where: { id: params.id },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const review = await prisma.review.update({
      where: { id: params.id },
      data: parsed.data
    });

    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    console.error("Failed to update review", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}
