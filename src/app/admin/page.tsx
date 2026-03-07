import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function isAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth")?.value === "true";
}

async function AdminContent() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      annotations: { orderBy: { order: "asc" } },
      devSpecs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-white">⚡ SmashForms Admin</h1>
      <p className="mb-6 text-sm text-zinc-400">{reviews.length} review{reviews.length === 1 ? "" : "s"} total</p>

      {reviews.length === 0 ? (
        <p className="text-zinc-500">No reviews yet.</p>
      ) : (
        <div className="space-y-8">
          {reviews.map((review) => (
            <section key={review.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{review.title || "Untitled"}</h2>
                  <p className="text-sm text-zinc-400">{review.targetUrl}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {review.status} · {new Date(review.createdAt).toLocaleString()} · {review.devEmail || "no email"}
                  </p>
                </div>
                <span className="rounded-full bg-violet-900/40 px-3 py-1 text-xs font-medium text-violet-200">
                  {review.annotations.length} annotation{review.annotations.length === 1 ? "" : "s"}
                </span>
              </div>

              {review.annotations.length > 0 && (
                <div className="mt-4 space-y-3">
                  {review.annotations.map((ann, i) => (
                    <div key={ann.id} className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                          {ann.order || i + 1}
                        </span>
                        <span className="text-xs font-medium text-zinc-300">{ann.type}</span>
                        <span className="text-xs text-zinc-500">
                          ({ann.positionX.toFixed(0)}%, {ann.positionY.toFixed(0)}%) scrollY={ann.scrollY.toFixed(0)}
                        </span>
                        <span className="ml-auto text-xs text-zinc-600">{new Date(ann.createdAt).toLocaleString()}</span>
                      </div>
                      {ann.comment && (
                        <p className="mt-2 text-sm text-zinc-200">{ann.comment}</p>
                      )}
                      {ann.aiFollowups && (
                        <div className="mt-2 rounded border border-zinc-700 bg-zinc-900/50 p-2">
                          <p className="text-[10px] uppercase tracking-wider text-violet-400">AI Follow-ups</p>
                          <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-400">
                            {JSON.stringify(ann.aiFollowups, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const password = typeof params.password === "string" ? params.password : undefined;
  const adminPassword = process.env.ADMIN_PASSWORD || "smashforms-admin";

  if (password === adminPassword) {
    const cookieStore = await cookies();
    cookieStore.set("admin_auth", "true", { httpOnly: true, maxAge: 60 * 60 * 24, path: "/admin" });
    redirect("/admin");
  }

  const authed = await isAuthenticated();

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <form className="w-80 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-lg font-semibold text-white">Admin Login</h1>
          <input
            name="password"
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Login
          </button>
        </form>
      </main>
    );
  }

  return <AdminContent />;
}
