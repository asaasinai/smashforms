"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Review = {
  id: string;
  targetUrl: string;
  title: string | null;
  devEmail: string | null;
  status: "DRAFT" | "ACTIVE" | "SUBMITTED" | "COMPLETED";
  createdAt: string;
};

export default function HomePage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const response = await fetch("/api/reviews");
        const payload = (await response.json()) as { reviews?: Review[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load reviews");
        }

        setReviews(payload.reviews ?? []);
      } catch (loadError) {
        console.error(loadError);
      } finally {
        setLoadingReviews(false);
      }
    };

    void loadReviews();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          title: title || undefined
        })
      });

      const payload = (await response.json()) as {
        review?: { id: string };
        error?: string;
      };

      if (!response.ok || !payload.review?.id) {
        throw new Error(payload.error ?? "Failed to create review");
      }

      router.push(`/review/${payload.review.id}`);
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while creating the review."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12">
      <section className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 shadow-2xl shadow-accent-950/40 md:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent-300">
          ⚡ SmashForms
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">
          Screenshot-first website feedback that becomes build-ready specs
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[rgb(var(--muted))]">
          Capture page states as you scroll, describe what should change, and let AI turn feedback into precise implementation guidance.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 md:grid-cols-8">
          <input
            required
            type="url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="https://preview-your-app.vercel.app"
            className="md:col-span-5 rounded-xl border border-[rgb(var(--border))] bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[rgb(var(--muted))] outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-700/50"
          />
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Review title (optional)"
            className="md:col-span-3 rounded-xl border border-[rgb(var(--border))] bg-black/20 px-4 py-3 text-sm text-white placeholder:text-[rgb(var(--muted))] outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-700/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="md:col-span-8 inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-[rgb(var(--accent-foreground))] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Review...
              </>
            ) : (
              "Start Review"
            )}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">How it works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            "Paste your preview URL and start a review session instantly.",
            "Capture screenshots while scrolling, then add raw notes to each frame.",
            "Use AI chat per screenshot to clarify requirements and lock exact specs."
          ].map((step, index) => (
            <article
              key={step}
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">
                Step {index + 1}
              </p>
              <p className="mt-2 text-sm text-[rgb(var(--foreground))]">{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent reviews</h2>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-accent-300 transition hover:text-accent-200"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          {loadingReviews ? (
            <p className="text-sm text-[rgb(var(--muted))]">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">No reviews yet.</p>
          ) : (
            reviews.slice(0, 8).map((review) => (
              <Link
                key={review.id}
                href={`/review/${review.id}`}
                className="block rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition hover:border-accent-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">
                    {review.title?.trim() || review.targetUrl}
                  </p>
                  <span className="rounded-full border border-accent-700/60 bg-accent-900/30 px-2 py-1 text-xs text-accent-200">
                    {review.status}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-[rgb(var(--muted))]">
                  {review.targetUrl}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
