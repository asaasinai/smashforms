import { AnnotationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createAnnotationSchema = z.object({
  reviewId: z.string().min(1),
  type: z.nativeEnum(AnnotationType),
  position: z.object({
    x: z.number(),
    y: z.number(),
    scrollY: z.number().optional(),
    viewportWidth: z.number().int().optional(),
    viewportHeight: z.number().int().optional(),
    elementSelector: z.string().optional()
  }),
  comment: z.string().max(5000).optional(),
  order: z.number().int().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const review = await prisma.review.findUnique({
      where: { id: parsed.data.reviewId },
      select: { id: true }
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const annotation = await prisma.annotation.create({
      data: {
        reviewId: parsed.data.reviewId,
        type: parsed.data.type,
        positionX: parsed.data.position.x,
        positionY: parsed.data.position.y,
        scrollY: parsed.data.position.scrollY ?? 0,
        viewportWidth: parsed.data.position.viewportWidth ?? 1440,
        viewportHeight: parsed.data.position.viewportHeight ?? 900,
        elementSelector: parsed.data.position.elementSelector,
        comment: parsed.data.comment,
        order: parsed.data.order ?? 0
      }
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    console.error("Failed to create annotation", error);
    return NextResponse.json(
      { error: "Failed to create annotation" },
      { status: 500 }
    );
  }
}
