import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/** Promote only the ready production build that passed the release's staged checks. */
export async function promoteDeployment(
  { deploymentUrl, projectId, teamId, sha, token },
  { fetchImpl = fetch, sleep = setTimeout, now = Date.now } = {},
) {
  if (
    !/^https:\/\/[a-zA-Z0-9.-]+\.vercel\.app\/?$/.test(deploymentUrl ?? '') ||
    !/^prj_[a-zA-Z0-9]+$/.test(projectId ?? '') ||
    !/^team_[a-zA-Z0-9]+$/.test(teamId ?? '') ||
    !/^[a-f0-9]{40}$/.test(sha ?? '') ||
    !token
  )
    throw new Error('Invalid release configuration');
  const request = async (path, method = 'GET') => {
    const response = await fetchImpl(`https://api.vercel.com${path}?teamId=${teamId}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Vercel API returned HTTP ${response.status}`);
    return response;
  };
  const hostname = new URL(deploymentUrl).hostname;
  const deployment = await (await request(`/v13/deployments/${hostname}`)).json();
  if (
    !/^dpl_[a-zA-Z0-9]+$/.test(deployment.id ?? '') ||
    deployment.projectId !== projectId ||
    deployment.url !== hostname ||
    deployment.target !== 'production' ||
    deployment.readyState !== 'READY' ||
    deployment.meta?.commit !== sha
  )
    throw new Error('Deployment does not match the checked production release');
  await request(`/v10/projects/${projectId}/promote/${deployment.id}`, 'POST');
  const deadline = now() + 300_000;
  while (now() < deadline) {
    const project = await (await request(`/v9/projects/${projectId}`)).json();
    const promotion = project.lastAliasRequest;
    if (promotion?.toDeploymentId === deployment.id) {
      if (promotion.jobStatus === 'succeeded') return deployment.id;
      if (promotion.jobStatus === 'failed') throw new Error('Promotion failed');
    }
    await sleep(2_000);
  }
  throw new Error('Promotion timed out; inspect Vercel before retrying');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const id = await promoteDeployment({
      // biome-ignore lint/suspicious/noUndeclaredEnvVars: Existing workflow-only input; this script does not run through Turbo.
      deploymentUrl: process.env.STAGED_URL,
      projectId: process.env.VERCEL_PROJECT_ID,
      teamId: process.env.VERCEL_ORG_ID,
      // biome-ignore lint/suspicious/noUndeclaredEnvVars: Existing pinned workflow commit, not an application build input.
      sha: process.env.RELEASE_SHA,
      token: process.env.VERCEL_TOKEN,
    });
    process.stdout.write(`Promoted checked production deployment ${id}\n`);
  } catch (error) {
    // Do not print API response objects, credentials, or exception stacks.
    process.stderr.write(
      `Promotion stopped: ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
