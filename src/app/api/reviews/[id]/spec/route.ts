import { prisma } from "@/lib/prisma";
import { completeWithGpt4o } from "@/lib/openai";
import { NextResponse } from "next/server";

type RouteContext = {
  params: { id: string };
};

export async function POST(_: Request, { params }: RouteContext) {
  try {
    const review = await prisma.review.findUnique({
      where: { id: params.id },
      include: {
        screenshots: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const locked = review.screenshots.filter((shot) => (shot.lockedSpec ?? "").trim().length > 0);
    if (locked.length === 0) {
      return NextResponse.json({ error: "No locked specs found" }, { status: 400 });
    }

    const compiledPrompt = [
      "You are a technical product specification writer.",
      "Compile the following screenshot-level locked specs into one developer-ready markdown document.",
      "Use clear sections, acceptance criteria, and implementation details.",
      `Review title: ${review.title ?? "Untitled Review"}`,
      `Target URL: ${review.targetUrl}`,
      "",
      ...locked.map(
        (shot, index) =>
          `## Screenshot ${index + 1}\nNotes: ${shot.notes ?? "None"}\nLocked Spec:\n${shot.lockedSpec ?? ""}`
      ),
    ].join("\n");

    const markdown = await completeWithGpt4o(
      [
        {
          role: "system",
          content:
            "Return only markdown. Be concise but complete. Include a final checklist developers can validate against.",
        },
        { role: "user", content: compiledPrompt },
      ],
      1800
    );

    const devSpec = await prisma.devSpec.create({
      data: {
        reviewId: review.id,
        specMarkdown: markdown,
        specJson: {
          source: "screenshots",
          screenshotCount: review.screenshots.length,
          lockedCount: locked.length,
        },
      },
    });

    await prisma.review.update({
      where: { id: review.id },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ spec: devSpec }, { status: 200 });
  } catch (error) {
    console.error("Failed to compile review spec", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compile spec" },
      { status: 500 }
    );
  }
}
