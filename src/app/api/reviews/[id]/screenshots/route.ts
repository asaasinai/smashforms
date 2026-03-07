import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createScreenshotSchema = z.object({
  imageData: z.string().min(1),
  order: z.number().int().nonnegative().optional(),
  notes: z.string().max(10000).optional(),
});

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const parsed = createScreenshotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      select: { id: true, _count: { select: { screenshots: true } } },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const screenshot = await prisma.screenshot.create({
      data: {
        reviewId: params.id,
        imageData: parsed.data.imageData,
        notes: parsed.data.notes,
        conversation: [],
        order: parsed.data.order ?? review._count.screenshots,
      },
    });

    return NextResponse.json({ screenshot }, { status: 201 });
  } catch (error) {
    console.error("Failed to create screenshot", error);
    return NextResponse.json({ error: "Failed to create screenshot" }, { status: 500 });
  }
}
