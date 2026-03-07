import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

type AiMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { annotationId, reviewId, messages } = body as {
      annotationId: string;
      reviewId: string;
      messages?: AiMessage[];
    };

    if (!annotationId || !reviewId) {
      return NextResponse.json({ error: "annotationId and reviewId required" }, { status: 400 });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    const annotation = await prisma.annotation.findUnique({ where: { id: annotationId } });
    if (!review || !annotation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fileTreeContext = review.repoFileTree
      ? `\n\nThe codebase files:\n${(review.repoFileTree as string[]).slice(0, 80).join("\n")}`
      : "";

    const conversationHistory = messages && messages.length > 0 ? messages : [];
    const lastUserMessage = conversationHistory.filter((m) => m.role === "user").pop()?.content ?? annotation.comment ?? "";

    const systemPrompt = `You are a UX feedback assistant. A client is annotating a web app at ${review.targetUrl}.
This annotation is a ${annotation.type} at (${annotation.positionX.toFixed(0)}%, ${annotation.positionY.toFixed(0)}%).${fileTreeContext}

Your job: ask 1-2 smart, specific follow-up questions to clarify the client's feedback.
- If they're vague, ask what specifically bothers them (color, layout, text, spacing)
- Reference specific files from the codebase when relevant
- Keep it short and conversational
Return ONLY valid JSON: { "questions": ["question1", "question2"] }`;

    const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const msg of conversationHistory) {
      claudeMessages.push({ role: msg.role, content: msg.content });
    }
    if (claudeMessages.length === 0) {
      claudeMessages.push({ role: "user", content: lastUserMessage });
    }

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    let questions: string[] = [];
    try {
      const parsed = JSON.parse(text);
      questions = parsed.questions ?? [];
    } catch {
      questions = [text];
    }

    // Build updated conversation
    const updatedMessages: AiMessage[] = [
      ...conversationHistory,
      { role: "assistant", content: questions.join("\n") },
    ];

    await prisma.annotation.update({
      where: { id: annotationId },
      data: { aiFollowups: updatedMessages },
    });

    return NextResponse.json({ messages: updatedMessages, questions });
  } catch (error) {
    console.error("AI followup error:", error);
    return NextResponse.json({ error: "Failed to generate follow-up" }, { status: 500 });
  }
}
