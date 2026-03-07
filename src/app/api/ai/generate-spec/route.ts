import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reviewId } = body;

    if (!reviewId) {
      return NextResponse.json({ error: "reviewId required" }, { status: 400 });
    }

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { annotations: { orderBy: { order: "asc" } } },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (review.annotations.length === 0) {
      return NextResponse.json({ error: "No annotations to generate spec from" }, { status: 400 });
    }

    const fileTreeContext = review.repoFileTree
      ? `\nFile tree:\n${(review.repoFileTree as string[]).slice(0, 200).join("\n")}`
      : "\nNo file tree available.";

    const annotationsList = review.annotations.map((a) =>
      `#${a.order} (${a.type}) at (${a.positionX.toFixed(0)}%, ${a.positionY.toFixed(0)}%):\n  Comment: ${a.comment ?? "(no comment)"}\n  AI Follow-ups: ${a.aiFollowups ? JSON.stringify(a.aiFollowups) : "none"}`
    ).join("\n\n");

    const prompt = `You are a technical spec writer. Generate a developer implementation spec from client feedback annotations.

Target URL: ${review.targetUrl}
GitHub Repo: ${review.githubRepo ?? "unknown"}
${fileTreeContext}

Annotations:
${annotationsList}

Generate a structured dev spec. Return ONLY valid JSON with this shape:
{
  "summary": "2-3 sentence executive summary",
  "sections": [
    {
      "file": "src/components/Example.tsx",
      "changes": [
        {
          "description": "what to change",
          "priority": "high|medium|low",
          "before": "current behavior",
          "after": "desired behavior"
        }
      ]
    }
  ],
  "crossCutting": ["responsive concerns", "accessibility notes"],
  "markdown": "The full spec as clean markdown with headers and bullet points"
}`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    let specJson: Prisma.InputJsonValue = {};
    let specMarkdown = text;

    try {
      specJson = JSON.parse(text) as Prisma.InputJsonValue;
      specMarkdown = (specJson as Record<string, string>).markdown ?? text;
    } catch {
      specJson = { raw: text };
    }

    const devSpec = await prisma.devSpec.create({
      data: {
        reviewId,
        specMarkdown,
        specJson,
      },
    });

    return NextResponse.json({ spec: devSpec });
  } catch (error) {
    console.error("Generate spec error:", error);
    return NextResponse.json({ error: "Failed to generate dev spec" }, { status: 500 });
  }
}
