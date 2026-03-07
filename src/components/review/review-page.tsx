"use client";

import html2canvas from "html2canvas";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

type AiMessage = { role: "user" | "assistant"; content: string };

type ScreenshotRecord = {
  id: string;
  reviewId: string;
  imageData: string;
  notes: string | null;
  conversation: unknown;
  lockedSpec: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type ReviewRecord = {
  id: string;
  targetUrl: string;
  title: string | null;
  status: "DRAFT" | "ACTIVE" | "SUBMITTED" | "COMPLETED";
  screenshots: ScreenshotRecord[];
  devSpecs?: Array<{ id: string; specMarkdown: string }>;
};

function parseConversation(raw: unknown): AiMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (message) =>
        message &&
        typeof message === "object" &&
        ("role" in message ? ((message as { role?: string }).role === "user" || (message as { role?: string }).role === "assistant") : false) &&
        ("content" in message ? typeof (message as { content?: unknown }).content === "string" : false)
    )
    .map((message) => ({
      role: (message as { role: "user" | "assistant" }).role,
      content: (message as { content: string }).content,
    }));
}

function buildFallbackScreenshot(url: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZkJQAAAAASUVORK5CYII=";
  }

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.fillStyle = "#7c3aed";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.fillText("SmashForms Screenshot Placeholder", 80, 140);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("Cross-origin pages may block full capture.", 80, 210);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(`URL: ${url}`, 80, 300);
  ctx.fillText(`Captured: ${new Date().toLocaleString()}`, 80, 350);

  return canvas.toDataURL("image/png");
}

export function ReviewPage({ id }: { id: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});
  const [chatting, setChatting] = useState<Record<string, boolean>>({});
  const [capturing, setCapturing] = useState(false);
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedScreenshots = useMemo(
    () => [...screenshots].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    [screenshots]
  );

  useEffect(() => {
    api<{ review: ReviewRecord }>(`/api/reviews/${id}`)
      .then(({ review: fetchedReview }) => {
        setReview(fetchedReview);
        setScreenshots(fetchedReview.screenshots ?? []);
        setGeneratedSpec(fetchedReview.devSpecs?.[0]?.specMarkdown ?? null);
      })
      .catch((err) => setError(`Failed to load review: ${String(err)}`));
  }, [id]);

  const updateScreenshotInState = (screenshotId: string, updater: (current: ScreenshotRecord) => ScreenshotRecord) => {
    setScreenshots((prev) => prev.map((screenshot) => (screenshot.id === screenshotId ? updater(screenshot) : screenshot)));
  };

  const patchScreenshot = async (
    screenshotId: string,
    payload: Partial<Pick<ScreenshotRecord, "notes" | "lockedSpec">> & { conversation?: AiMessage[] | null }
  ) => {
    try {
      const { screenshot } = await api<{ screenshot: ScreenshotRecord }>(
        `/api/reviews/${id}/screenshots/${screenshotId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
      updateScreenshotInState(screenshotId, () => screenshot);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Failed to save screenshot changes");
    }
  };

  const captureScreenshot = async () => {
    if (!review) return;

    setError(null);
    setNotice(null);
    setCapturing(true);

    try {
      const iframeElement = iframeRef.current;
      if (!iframeElement) {
        throw new Error("Iframe is not available");
      }

      let imageData = "";
      let usedFallback = false;

      try {
        const frameWindow = iframeElement.contentWindow;
        const frameDocument = iframeElement.contentDocument;
        const frameRoot = frameDocument?.documentElement;

        if (!frameWindow || !frameRoot) {
          throw new Error("Iframe content is not accessible");
        }

        const canvas = await html2canvas(frameRoot, {
          backgroundColor: "#0f172a",
          useCORS: true,
          width: frameWindow.innerWidth,
          height: frameWindow.innerHeight,
          windowWidth: frameWindow.innerWidth,
          windowHeight: frameWindow.innerHeight,
          scrollX: frameWindow.scrollX,
          scrollY: frameWindow.scrollY,
        });

        imageData = canvas.toDataURL("image/png");
      } catch {
        usedFallback = true;
        imageData = buildFallbackScreenshot(review.targetUrl);
      }

      const { screenshot } = await api<{ screenshot: ScreenshotRecord }>(`/api/reviews/${id}/screenshots`, {
        method: "POST",
        body: JSON.stringify({
          imageData,
          order: screenshots.length,
        }),
      });

      setScreenshots((prev) => [...prev, screenshot]);

      if (usedFallback) {
        setNotice(
          "Screenshot captured — cross-origin sites may not render. Your notes and specs are saved."
        );
      } else {
        setNotice("Screenshot captured.");
      }
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Failed to capture screenshot");
    } finally {
      setCapturing(false);
    }
  };

  const saveNotes = async (screenshotId: string, notes: string) => {
    setSavingNotes((prev) => ({ ...prev, [screenshotId]: true }));
    await patchScreenshot(screenshotId, { notes: notes.trim() || null });
    setSavingNotes((prev) => ({ ...prev, [screenshotId]: false }));
  };

  const sendChat = async (screenshotId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const screenshot = screenshots.find((item) => item.id === screenshotId);
    if (!screenshot) return;

    const baseMessages = parseConversation(screenshot.conversation);
    const userMessages = [...baseMessages, { role: "user" as const, content: trimmed }];

    updateScreenshotInState(screenshotId, (current) => ({
      ...current,
      conversation: userMessages,
    }));
    setDraftMessages((prev) => ({ ...prev, [screenshotId]: "" }));
    setChatting((prev) => ({ ...prev, [screenshotId]: true }));

    try {
      const response = await api<{ reply: string; messages: AiMessage[] }>(`/api/reviews/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({ screenshotId, messages: userMessages }),
      });

      updateScreenshotInState(screenshotId, (current) => ({
        ...current,
        conversation: response.messages,
      }));
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Failed to send message");
      updateScreenshotInState(screenshotId, (current) => ({
        ...current,
        conversation: baseMessages,
      }));
    } finally {
      setChatting((prev) => ({ ...prev, [screenshotId]: false }));
    }
  };

  const lockSpec = async (screenshotId: string) => {
    const screenshot = screenshots.find((item) => item.id === screenshotId);
    if (!screenshot) return;

    const conversation = parseConversation(screenshot.conversation);
    const lastAssistantMessage = [...conversation].reverse().find((message) => message.role === "assistant");
    const candidate = (lastAssistantMessage?.content ?? screenshot.notes ?? "").trim();

    if (!candidate) {
      setError("Add notes or chat with AI before locking a spec.");
      return;
    }

    await patchScreenshot(screenshotId, { lockedSpec: candidate });
  };

  const unlockSpec = async (screenshotId: string) => {
    await patchScreenshot(screenshotId, { lockedSpec: null });
  };

  const generateFullSpec = async () => {
    if (!review) return;
    setGeneratingSpec(true);

    try {
      const { spec } = await api<{ spec: { specMarkdown: string } }>(`/api/reviews/${id}/spec`, {
        method: "POST",
      });

      setGeneratedSpec(spec.specMarkdown);
      setReview((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev));
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate full spec");
    } finally {
      setGeneratingSpec(false);
    }
  };

  if (!review) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[rgb(var(--muted))]">Loading review…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[rgb(var(--surface))]">
      <header className="flex items-center gap-4 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-3">
        <Link href="/" className="text-sm font-semibold text-accent-300">
          ⚡ SmashForms
        </Link>
        <span className="truncate text-xs text-[rgb(var(--muted))]">
          {review.title?.trim() || review.targetUrl}
        </span>
        <span className="ml-auto rounded-full border border-accent-700/60 bg-accent-900/30 px-2 py-1 text-[10px] text-accent-200">
          {review.status}
        </span>
      </header>

      <div className="grid flex-1 gap-0 lg:grid-cols-[2fr_1fr]">
        <section className="relative border-b border-[rgb(var(--border))] lg:border-b-0 lg:border-r">
          <iframe
            ref={iframeRef}
            src={review.targetUrl}
            title="Review target"
            className="h-[70vh] w-full border-0 lg:h-full"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
          <button
            type="button"
            onClick={() => void captureScreenshot()}
            disabled={capturing}
            className="absolute bottom-4 right-4 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-[rgb(var(--accent-foreground))] shadow-lg transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {capturing ? "Capturing..." : "📸 Screenshot"}
          </button>
        </section>

        <aside className="max-h-[70vh] overflow-y-auto bg-[rgb(var(--surface-2))] p-4 lg:max-h-none">
          <h2 className="text-sm font-semibold text-white">
            Screenshots{" "}
            <span className="text-xs text-[rgb(var(--muted))]">({sortedScreenshots.length})</span>
          </h2>

          {sortedScreenshots.length === 0 ? (
            <div className="mt-6 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]/60 p-4 text-sm text-[rgb(var(--muted))]">
              Capture your first screenshot to start writing notes and chatting with AI.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {sortedScreenshots.map((screenshot, index) => {
                const conversation = parseConversation(screenshot.conversation);
                const draft = draftMessages[screenshot.id] ?? "";
                const isSavingNotes = savingNotes[screenshot.id] === true;
                const isChatting = chatting[screenshot.id] === true;

                return (
                  <article
                    key={screenshot.id}
                    className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent-300">
                      Screenshot {index + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() => setExpandedImage(screenshot.imageData)}
                      className="mt-2 block overflow-hidden rounded-lg border border-[rgb(var(--border))]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshot.imageData}
                        alt={`Screenshot ${index + 1}`}
                        className="h-36 w-full object-cover"
                      />
                    </button>

                    <div className="mt-3">
                      <label className="text-xs text-[rgb(var(--muted))]">Raw notes</label>
                      <textarea
                        value={screenshot.notes ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          updateScreenshotInState(screenshot.id, (current) => ({ ...current, notes: nextValue }));
                        }}
                        onBlur={() => void saveNotes(screenshot.id, screenshot.notes ?? "")}
                        placeholder="The button is too small, this area feels cluttered..."
                        rows={3}
                        className="mt-1 w-full resize-y rounded-lg border border-[rgb(var(--border))] bg-black/20 px-2 py-2 text-xs text-white outline-none focus:border-accent-600"
                      />
                      <p className="mt-1 text-[10px] text-[rgb(var(--muted))]">
                        {isSavingNotes ? "Saving notes..." : "Notes auto-save on blur"}
                      </p>
                    </div>

                    <div className="mt-3 rounded-lg border border-[rgb(var(--border))] bg-black/20 p-2">
                      <p className="text-xs font-medium text-white">AI chat</p>
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                        {conversation.length === 0 ? (
                          <p className="text-xs text-[rgb(var(--muted))]">
                            Send notes or a message to get clarifying questions.
                          </p>
                        ) : (
                          conversation.map((message, messageIndex) => (
                            <div
                              key={`${screenshot.id}-${messageIndex}`}
                              className={`rounded-md px-2 py-1 text-xs ${
                                message.role === "assistant"
                                  ? "border border-accent-800/70 bg-accent-900/30 text-accent-100"
                                  : "border border-zinc-700 bg-zinc-900/40 text-zinc-200"
                              }`}
                            >
                              <span className="mb-1 block text-[10px] uppercase tracking-wide opacity-70">
                                {message.role === "assistant" ? "AI" : "You"}
                              </span>
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-2 space-y-2">
                        <textarea
                          value={draft}
                          onChange={(event) =>
                            setDraftMessages((prev) => ({ ...prev, [screenshot.id]: event.target.value }))
                          }
                          placeholder="Reply to AI or send fresh guidance..."
                          rows={2}
                          className="w-full resize-y rounded-md border border-[rgb(var(--border))] bg-black/30 px-2 py-1 text-xs text-white outline-none focus:border-accent-600"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void sendChat(screenshot.id, screenshot.notes ?? "")}
                            disabled={isChatting || !(screenshot.notes ?? "").trim()}
                            className="rounded-md border border-accent-700/60 px-2 py-1 text-xs text-accent-200 transition hover:border-accent-500 hover:text-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Send Notes to AI
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendChat(screenshot.id, draft)}
                            disabled={isChatting || draft.trim().length === 0}
                            className="rounded-md bg-accent-600 px-2 py-1 text-xs font-semibold text-[rgb(var(--accent-foreground))] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isChatting ? "AI thinking..." : "Send"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-[rgb(var(--border))] bg-black/20 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-white">Locked spec</p>
                        {screenshot.lockedSpec ? (
                          <button
                            type="button"
                            onClick={() => void unlockSpec(screenshot.id)}
                            className="text-xs text-zinc-300 transition hover:text-white"
                          >
                            Unlock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void lockSpec(screenshot.id)}
                            className="text-xs text-accent-200 transition hover:text-accent-100"
                          >
                            Lock Spec
                          </button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-[rgb(var(--foreground))]">
                        {screenshot.lockedSpec?.trim()
                          ? screenshot.lockedSpec
                          : "Not locked yet. Lock once the AI summary is clear."}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      <section className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-white">Review summary</h3>
            <button
              type="button"
              onClick={() => void generateFullSpec()}
              disabled={
                generatingSpec ||
                sortedScreenshots.filter((screenshot) => (screenshot.lockedSpec ?? "").trim().length > 0).length === 0
              }
              className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-[rgb(var(--accent-foreground))] transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingSpec ? "Generating..." : "Generate Full Spec"}
            </button>
            <Link href={`/review/${id}/spec`} className="text-xs text-accent-300 hover:text-accent-200">
              Open spec page →
            </Link>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {sortedScreenshots.map((screenshot, index) => (
              <div
                key={`summary-${screenshot.id}`}
                className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3"
              >
                <p className="text-xs font-semibold text-accent-300">Screenshot {index + 1}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-[rgb(var(--foreground))]">
                  {screenshot.lockedSpec?.trim() ? screenshot.lockedSpec : "No locked spec yet."}
                </p>
              </div>
            ))}
          </div>

          {generatedSpec ? (
            <details className="mt-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-white">
                Full compiled spec
              </summary>
              <pre className="overflow-x-auto border-t border-[rgb(var(--border))] p-3 text-xs text-[rgb(var(--foreground))] whitespace-pre-wrap">
                {generatedSpec}
              </pre>
            </details>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-red-900/80 px-3 py-2 text-sm text-red-100 shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="fixed left-4 top-4 z-50 rounded-lg border border-accent-700/50 bg-accent-900/70 px-3 py-2 text-sm text-accent-100 shadow-lg">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-2 text-accent-200 hover:text-white">
            ✕
          </button>
        </div>
      ) : null}

      {expandedImage ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute right-4 top-4 rounded bg-black/60 px-3 py-1 text-sm text-white"
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedImage} alt="Expanded screenshot" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        </div>
      ) : null}
    </main>
  );
}
