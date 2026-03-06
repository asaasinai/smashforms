import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SpecPageProps = {
  params: { id: string };
};

export const dynamic = "force-dynamic";

export default async function SpecPage({ params }: SpecPageProps) {
  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: {
      devSpecs: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!review) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6">
        <p className="text-sm text-red-300">Review not found.</p>
      </main>
    );
  }

  const latestSpec = review.devSpecs[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
      <header className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-300">Developer Spec</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          {review.title?.trim() || "Untitled review"}
        </h1>
        <p className="mt-2 text-sm text-[rgb(var(--muted))]">Review ID: {review.id}</p>
        <Link
          href={`/review/${review.id}`}
          className="mt-4 inline-block text-sm text-accent-300 transition hover:text-accent-200"
        >
          Back to review
        </Link>
      </header>

      <section className="mt-8 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8">
        {latestSpec ? (
          <article className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-6">
            {latestSpec.specMarkdown}
          </article>
        ) : (
          <p className="text-sm text-[rgb(var(--muted))]">
            Dev spec not yet generated.
          </p>
        )}
      </section>
    </main>
  );
}
