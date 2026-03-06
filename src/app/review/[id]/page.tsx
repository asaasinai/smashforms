"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Annotation = {
  id: string;
  type: "PIN" | "HIGHLIGHT" | "DRAW";
  comment: string | null;
  positionX: number;
  positionY: number;
  createdAt: string;
};

type Review = {
  id: string;
  targetUrl: string;
  title: string | null;
  devEmail: string | null;
  status: "DRAFT" | "ACTIVE" | "SUBMITTED" | "COMPLETED";
  annotations: Annotation[];
};

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const reviewId = useMemo(() => params.id, [params.id]);

  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadReview = async () => {
      try {
        const response = await fetch(`/api/reviews/${reviewId}`);
        const payload = (await response.json()) as { review?: Review; error?: string };

        if (!response.ok || !payload.review) {
          throw new Error(payload.error ?? "Failed to load review");
        }

        setReview(payload.review);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load review");
      } finally {
        setLoading(false);
      }
    };

    void loadReview();
  }, [reviewId]);

  const handleSubmitFeedback = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/webhook/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to submit feedback");
      }

      router.refresh();
      window.location.reload();
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError instanceof Error ? submitError.message : "Failed to submit feedback"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6">
        <p className="text-sm text-[rgb(var(--muted))]">Loading review...</p>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6">
        <p className="text-sm text-red-300">{error ?? "Review not found."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
      <header className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-300">Review</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          {review.title?.trim() || "Untitled review"}
        </h1>
        <p className="mt-3 break-all text-sm text-[rgb(var(--muted))]">{review.targetUrl}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-accent-700/60 bg-accent-900/30 px-3 py-1 text-xs font-medium text-accent-200">
            Status: {review.status}
          </span>
          <Link
            href={`/review/${review.id}/spec`}
            className="text-sm text-accent-300 transition hover:text-accent-200"
          >
            Open Dev Spec
          </Link>
        </div>
        <button
          type="button"
          onClick={handleSubmitFeedback}
          disabled={submitting}
          className="mt-6 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Annotations</h2>
        <div className="mt-4 space-y-3">
          {review.annotations.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">
              No annotations have been added yet.
            </p>
          ) : (
            review.annotations.map((annotation, index) => (
              <article
                key={annotation.id}
                className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">
                    #{index + 1} • {annotation.type}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    ({annotation.positionX.toFixed(0)}, {annotation.positionY.toFixed(0)})
                  </p>
                </div>
                <p className="mt-2 text-sm text-[rgb(var(--foreground))]">
                  {annotation.comment?.trim() || "No comment provided."}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
