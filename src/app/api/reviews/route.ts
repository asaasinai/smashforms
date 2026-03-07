import { ReviewStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { fetchRepoContext } from "@/lib/vercel-context";
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

    // Fire-and-forget: fetch repo context from Vercel/GitHub
    fetchRepoContext(parsed.data.targetUrl).then((ctx) => {
      if (ctx.githubRepo) {
        prisma.review.update({
          where: { id: review.id },
          data: {
            githubRepo: ctx.githubRepo,
            repoFileTree: ctx.repoFileTree ?? undefined,
          },
        }).catch(console.error);
      }
    }).catch(console.error);

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Failed to create review", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
