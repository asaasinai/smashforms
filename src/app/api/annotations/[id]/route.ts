import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchAnnotationSchema = z
  .object({
    comment: z.string().max(5000).nullable().optional(),
    aiFollowups: z.any().nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

type RouteContext = {
  params: { id: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const parsed = patchAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.annotation.findUnique({
      where: { id: params.id },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    const data: {
      comment?: string | null;
      aiFollowups?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    } = {};

    if ("comment" in parsed.data) {
      data.comment = parsed.data.comment;
    }

    if ("aiFollowups" in parsed.data) {
      data.aiFollowups =
        parsed.data.aiFollowups === null
          ? Prisma.JsonNull
          : (parsed.data.aiFollowups as Prisma.InputJsonValue);
    }

    const annotation = await prisma.annotation.update({
      where: { id: params.id },
      data
    });

    return NextResponse.json({ annotation }, { status: 200 });
  } catch (error) {
    console.error("Failed to update annotation", error);
    return NextResponse.json(
      { error: "Failed to update annotation" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const existing = await prisma.annotation.findUnique({
      where: { id: params.id },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    await prisma.annotation.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete annotation", error);
    return NextResponse.json(
      { error: "Failed to delete annotation" },
      { status: 500 }
    );
  }
}
