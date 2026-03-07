import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { annotationId, comment, reviewId } = body;

    if (!annotationId || !comment || !reviewId) {
      return NextResponse.json({ error: "annotationId, comment, and reviewId required" }, { status: 400 });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    const annotation = await prisma.annotation.findUnique({ where: { id: annotationId } });

    if (!review || !annotation) {
      return NextResponse.json({ error: "Review or annotation not found" }, { status: 404 });
    }

    const fileTreeContext = review.repoFileTree
      ? `\n\nThe codebase has these files:\n${(review.repoFileTree as string[]).slice(0, 100).join("\n")}`
      : "";

    const prompt = `You are a UX feedback assistant for SmashForms. A client is reviewing a web application and left this annotation:

Comment: "${comment}"
Annotation type: ${annotation.type}
Position: (${annotation.positionX.toFixed(0)}%, ${annotation.positionY.toFixed(0)}%) on the page
Target URL: ${review.targetUrl}${fileTreeContext}

Ask 1-2 smart, specific follow-up questions to clarify the feedback. Examples:
- If they say "I don't like this" → ask about color, layout, text, or something else
- If near a nav element → reference the specific component file
- If about spacing → ask about desktop vs mobile

Keep questions short and conversational. Reference specific files/components when relevant.
Return ONLY valid JSON: { "questions": ["question1", "question2"] }`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    let questions: string[] = [];
    try {
      const parsed = JSON.parse(text);
      questions = parsed.questions ?? [];
    } catch {
      questions = [text];
    }

    await prisma.annotation.update({
      where: { id: annotationId },
      data: { aiFollowups: questions },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("AI followup error:", error);
    return NextResponse.json({ error: "Failed to generate follow-up questions" }, { status: 500 });
  }
}
