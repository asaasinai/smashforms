import { prisma } from "@/lib/prisma";
import { completeWithGpt4o } from "@/lib/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const chatRequestSchema = z.object({
  screenshotId: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    })
  ),
});

const SYSTEM_PROMPT =
  "You are a product feedback assistant. The user is reviewing a website and has taken a screenshot. They will describe what they want changed. Ask targeted clarifying questions to extract precise, developer-actionable specifications (dimensions, colors, copy, behavior, etc.). Be concise. When the spec is clear, summarize it in a bullet list.";

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const screenshot = await prisma.screenshot.findFirst({
      where: { id: parsed.data.screenshotId, reviewId: params.id },
      include: {
        review: {
          select: {
            targetUrl: true,
            title: true,
          },
        },
      },
    });

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }

    const assistantReply = await completeWithGpt4o(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `Review title: ${screenshot.review.title ?? "Untitled"}\nTarget URL: ${screenshot.review.targetUrl}\nCurrent notes: ${
            screenshot.notes ?? "None"
          }`,
        },
        ...parsed.data.messages,
      ],
      700
    );

    const updatedMessages = [
      ...parsed.data.messages,
      { role: "assistant" as const, content: assistantReply },
    ];

    await prisma.screenshot.update({
      where: { id: screenshot.id },
      data: {
        conversation: updatedMessages,
      },
    });

    return NextResponse.json(
      {
        reply: assistantReply,
        messages: updatedMessages,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to run screenshot chat", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run chat" },
      { status: 500 }
    );
  }
}
