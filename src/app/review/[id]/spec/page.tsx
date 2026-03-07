import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

interface SpecChange {
  description: string;
  priority: string;
  before: string;
  after: string;
}

interface SpecSection {
  file: string;
  changes: SpecChange[];
}

interface SpecJson {
  summary?: string;
  sections?: SpecSection[];
  crossCutting?: string[];
  markdown?: string;
}

export default async function SpecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      devSpecs: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { screenshots: true } },
    },
  });

  if (!review) return notFound();

  const spec = review.devSpecs[0];
  const specData = spec?.specJson as SpecJson | null;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href={`/review/${id}`} className="text-sm text-violet-400 hover:text-violet-300">
            ← Back to review
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            ⚡ Dev Spec: {review.title || review.targetUrl}
          </h1>
        </div>
        <span className="rounded-full bg-violet-900/40 px-3 py-1 text-xs font-medium text-violet-200">
          {review.status}
        </span>
      </div>

      {!spec ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">No spec generated yet.</p>
          <p className="mt-2 text-sm text-zinc-500">
            {review._count.screenshots === 0
              ? "Capture screenshots first, then lock specs."
              : "Lock screenshot specs and generate the full review spec."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {specData?.summary && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-3 text-lg font-semibold text-white">Summary</h2>
              <p className="text-sm leading-relaxed text-zinc-300">{specData.summary}</p>
            </section>
          )}

          {specData?.sections?.map((section, i) => (
            <section key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 font-mono text-sm font-semibold text-violet-300">
                {section.file}
              </h3>
              <div className="space-y-4">
                {section.changes.map((change, j) => (
                  <div key={j} className="border-l-2 border-zinc-700 pl-4">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        change.priority === "high" ? "bg-red-900/50 text-red-300" :
                        change.priority === "medium" ? "bg-yellow-900/50 text-yellow-300" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>
                        {change.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-200">{change.description}</p>
                    {change.before && (
                      <p className="mt-1 text-xs text-zinc-500">Before: {change.before}</p>
                    )}
                    {change.after && (
                      <p className="text-xs text-zinc-400">After: {change.after}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {specData?.crossCutting && specData.crossCutting.length > 0 && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-3 text-lg font-semibold text-white">Cross-Cutting Concerns</h2>
              <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
                {specData.crossCutting.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </section>
          )}

          <details className="rounded-xl border border-zinc-800 bg-zinc-900">
            <summary className="cursor-pointer p-6 text-sm font-medium text-zinc-400 hover:text-zinc-300">
              Raw Markdown
            </summary>
            <pre className="overflow-auto border-t border-zinc-800 p-6 text-xs text-zinc-400 whitespace-pre-wrap">
              {spec.specMarkdown}
            </pre>
          </details>
        </div>
      )}
    </main>
  );
}
