import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { sendDevSpec } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reviewId } = body;

    if (!reviewId) {
      return NextResponse.json({ error: "reviewId required" }, { status: 400 });
    }

    // Set status to SUBMITTED
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status: "SUBMITTED" },
      include: { annotations: { orderBy: { order: "asc" } } },
    });

    if (review.annotations.length === 0) {
      return NextResponse.json({ error: "No annotations to generate spec from" }, { status: 400 });
    }

    // Generate dev spec
    const fileTreeContext = review.repoFileTree
      ? `\nFile tree:\n${(review.repoFileTree as string[]).slice(0, 200).join("\n")}`
      : "";

    const annotationsList = review.annotations.map((a) =>
      `#${a.order} (${a.type}) at (${a.positionX.toFixed(0)}%, ${a.positionY.toFixed(0)}%):\n  Comment: ${a.comment ?? "(no comment)"}\n  Follow-ups: ${a.aiFollowups ? JSON.stringify(a.aiFollowups) : "none"}`
    ).join("\n\n");

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `You are a technical spec writer. Generate a dev spec from these client annotations on ${review.targetUrl}.
${review.githubRepo ? `Repo: ${review.githubRepo}` : ""}${fileTreeContext}

Annotations:
${annotationsList}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary",
  "sections": [{ "file": "path", "changes": [{ "description": "...", "priority": "high|medium|low", "before": "...", "after": "..." }] }],
  "crossCutting": ["..."],
  "markdown": "Full spec as markdown"
}`
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    let specJson: Record<string, unknown> = {};
    let specMarkdown = text;
    try {
      specJson = JSON.parse(text);
      specMarkdown = (specJson.markdown as string) ?? text;
    } catch {
      specJson = { raw: text };
    }

    const devSpec = await prisma.devSpec.create({
      data: { reviewId, specMarkdown, specJson },
    });

    // Send email if devEmail exists
    if (review.devEmail) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://smashforms.vercel.app";
        await sendDevSpec({
          to: review.devEmail,
          reviewTitle: review.title ?? "",
          targetUrl: review.targetUrl,
          specMarkdown,
          reviewUrl: `${baseUrl}/review/${reviewId}/spec`,
        });
      } catch (emailError) {
        console.error("Email send failed:", emailError);
      }
    }

    // Mark completed
    await prisma.review.update({
      where: { id: reviewId },
      data: { status: "COMPLETED" },
    });

    return NextResponse.json({ success: true, spec: devSpec });
  } catch (error) {
    console.error("Submit webhook error:", error);
    return NextResponse.json({ error: "Failed to process submission" }, { status: 500 });
  }
}
