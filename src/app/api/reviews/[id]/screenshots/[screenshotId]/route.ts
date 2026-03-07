import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchScreenshotSchema = z
  .object({
    notes: z.string().max(10000).nullable().optional(),
    conversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).nullable().optional(),
    lockedSpec: z.string().max(20000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

type RouteContext = {
  params: { id: string; screenshotId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const parsed = patchScreenshotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.screenshot.findFirst({
      where: { id: params.screenshotId, reviewId: params.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }

    const data: {
      notes?: string | null;
      lockedSpec?: string | null;
      conversation?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    } = {};

    if ("notes" in parsed.data) {
      data.notes = parsed.data.notes;
    }

    if ("lockedSpec" in parsed.data) {
      data.lockedSpec = parsed.data.lockedSpec;
    }

    if ("conversation" in parsed.data) {
      data.conversation =
        parsed.data.conversation === null
          ? Prisma.JsonNull
          : (parsed.data.conversation as Prisma.InputJsonValue);
    }

    const screenshot = await prisma.screenshot.update({
      where: { id: params.screenshotId },
      data,
    });

    return NextResponse.json({ screenshot }, { status: 200 });
  } catch (error) {
    console.error("Failed to update screenshot", error);
    return NextResponse.json({ error: "Failed to update screenshot" }, { status: 500 });
  }
}
