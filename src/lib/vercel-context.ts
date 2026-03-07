export async function fetchRepoContext(targetUrl: string): Promise<{
  githubRepo: string | null;
  repoFileTree: string[] | null;
}> {
  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname;

    // Extract project name: "smashforms" from "smashforms.vercel.app" or "smashforms-xxx.vercel.app"
    const match = hostname.match(/^([a-z0-9-]+?)(?:-[a-z0-9]+)?\.vercel\.app$/);
    if (!match) return { githubRepo: null, repoFileTree: null };

    const projectName = match[1];
    const vercelToken = process.env.VERCEL_TOKEN;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!vercelToken) return { githubRepo: null, repoFileTree: null };

    // Get project info from Vercel
    const projectRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });

    if (!projectRes.ok) return { githubRepo: null, repoFileTree: null };

    const project = await projectRes.json() as { link?: { repo?: string; org?: string } };
    const repo = project.link?.repo;
    const org = project.link?.org;

    if (!repo || !org) return { githubRepo: null, repoFileTree: null };

    const githubRepo = `${org}/${repo}`;

    if (!githubToken) return { githubRepo, repoFileTree: null };

    // Get file tree from GitHub
    const treeRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/trees/main?recursive=1`,
      { headers: { Authorization: `token ${githubToken}`, Accept: "application/vnd.github.v3+json" } },
    );

    if (!treeRes.ok) return { githubRepo, repoFileTree: null };

    const tree = await treeRes.json() as { tree?: Array<{ path: string; type: string }> };
    const files = (tree.tree ?? [])
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .slice(0, 500); // Cap at 500 files

    return { githubRepo, repoFileTree: files };
  } catch (error) {
    console.error("Failed to fetch repo context:", error);
    return { githubRepo: null, repoFileTree: null };
  }
}
