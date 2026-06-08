import crypto from "node:crypto";
import type { Database } from "@/integrations/supabase/types";

export type GithubInstallation =
  Database["public"]["Tables"]["user_github_installations"]["Row"];

export interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
}

export function generateAppJwt(appId: string, privateKey: string): string {
  // Use a lightweight JWT generation or a library.
  // We will stub this for now, expecting GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iat: now - 60,
      exp: now + 10 * 60,
      iss: appId,
    })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, "base64url");
  return `${header}.${payload}.${signature}`;
}

export async function fetchInstallationToken(installationId: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error("Missing GitHub App credentials in environment variables.");
  }

  const jwt = generateAppJwt(appId, privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "NexusCore-Platform",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch installation token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

export async function listInstallationRepositories(
  installationId: string
): Promise<GithubRepository[]> {
  const token = await fetchInstallationToken(installationId);
  const response = await fetch(`https://api.github.com/installation/repositories`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "NexusCore-Platform",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list repositories: ${response.statusText}`);
  }

  const data = await response.json();
  return data.repositories;
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // Bypass if secret is not set (e.g., local dev)

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function createPullRequestWithChanges(
  installationId: string,
  repoFullName: string,
  branchName: string,
  title: string,
  body: string,
  files: { path: string; content: string }[]
) {
  const token = await fetchInstallationToken(installationId);
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "NexusCore-Platform",
  };
  const apiUrl = `https://api.github.com/repos/${repoFullName}`;

  // 1. Get default branch
  const repoRes = await fetch(apiUrl, { headers });
  if (!repoRes.ok) throw new Error("Failed to fetch repo details");
  const repoData = await repoRes.json();
  const baseBranch = repoData.default_branch;

  // 2. Get latest commit SHA
  const refRes = await fetch(`${apiUrl}/git/ref/heads/${baseBranch}`, { headers });
  if (!refRes.ok) throw new Error("Failed to fetch base ref");
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 3. Get latest commit tree
  const commitRes = await fetch(`${apiUrl}/git/commits/${latestCommitSha}`, { headers });
  if (!commitRes.ok) throw new Error("Failed to fetch latest commit");
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 4. Create blobs and tree array
  const treeEntries = await Promise.all(
    files.map(async (f) => {
      const blobRes = await fetch(`${apiUrl}/git/blobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: f.content, encoding: "utf-8" })
      });
      if (!blobRes.ok) throw new Error(`Failed to create blob for ${f.path}`);
      const blobData = await blobRes.json();
      return {
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: blobData.sha
      };
    })
  );

  // 5. Create new tree
  const treeRes = await fetch(`${apiUrl}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
  });
  if (!treeRes.ok) throw new Error("Failed to create tree");
  const treeData = await treeRes.json();
  const newTreeSha = treeData.sha;

  // 6. Create new commit
  const newCommitRes = await fetch(`${apiUrl}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: title,
      tree: newTreeSha,
      parents: [latestCommitSha]
    })
  });
  if (!newCommitRes.ok) throw new Error("Failed to create commit");
  const newCommitData = await newCommitRes.json();
  const newCommitSha = newCommitData.sha;

  // 7. Create branch ref
  const createRefRes = await fetch(`${apiUrl}/git/refs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: newCommitSha
    })
  });
  if (!createRefRes.ok) throw new Error(`Failed to create branch ref: ${await createRefRes.text()}`);

  // 8. Create PR
  const prRes = await fetch(`${apiUrl}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title,
      body,
      head: branchName,
      base: baseBranch
    })
  });
  if (!prRes.ok) throw new Error("Failed to create pull request");
  return prRes.json();
}
