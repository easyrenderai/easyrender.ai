import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promoteDeployment } from './promote-vercel.mjs';

const config = {
  deploymentUrl: 'https://fixture.vercel.app',
  projectId: 'prj_fixture',
  teamId: 'team_fixture',
  sha: 'a'.repeat(40),
  token: 'synthetic-fixture-token',
};
const deployment = {
  id: 'dpl_fixture',
  projectId: config.projectId,
  url: 'fixture.vercel.app',
  target: 'production',
  readyState: 'READY',
  meta: { commit: config.sha },
};
function transport(overrides = {}, status = 'succeeded', isQueued = false) {
  let hasPromoted = false;
  let time = 0;
  return {
    hasPromoted: () => hasPromoted,
    dependencies: {
      now: () => time,
      sleep: async () => {
        time += 60_000;
      },
      fetchImpl: async (url, init) => {
        const target = new URL(url);
        assert.equal(target.origin, 'https://api.vercel.com');
        assert.equal(target.searchParams.get('teamId'), config.teamId);
        assert.equal(init.headers.Authorization, `Bearer ${config.token}`);
        if (target.pathname === '/v13/deployments/fixture.vercel.app')
          return Response.json({ ...deployment, ...overrides });
        if (target.pathname === '/v10/projects/prj_fixture/promote/dpl_fixture') {
          assert.equal(init.method, 'POST');
          assert.deepEqual(JSON.parse(init.body), {});
          hasPromoted = true;
          return new Response(null, { status: isQueued ? 202 : 200 });
        }
        if (target.pathname === '/v9/projects/prj_fixture')
          return Response.json(
            target.searchParams.get('rollbackInfo') === 'true'
              ? {
                  lastAliasRequest: { toDeploymentId: 'dpl_fixture', jobStatus: status },
                }
              : {},
          );
        throw new Error('Unexpected API request, including user-profile lookup');
      },
    },
  };
}

test('promotes the checked production build without requiring a user profile', async () => {
  const fixture = transport();
  assert.equal(await promoteDeployment(config, fixture.dependencies), deployment.id);
  assert.equal(fixture.hasPromoted(), true);
});
for (const [label, overrides] of Object.entries({
  'another project': { projectId: 'prj_other' },
  'another commit': { meta: { commit: 'b'.repeat(40) } },
  'a preview': { target: 'preview' },
  'an unready build': { readyState: 'BUILDING' },
  'a different deployment URL': { url: 'other.vercel.app' },
}))
  test(`refuses ${label} before promotion`, async () => {
    const fixture = transport(overrides);
    await assert.rejects(
      promoteDeployment(config, fixture.dependencies),
      /Deployment does not match/,
    );
    assert.equal(fixture.hasPromoted(), false);
  });
test('does not report a failed alias operation as successful', async () => {
  await assert.rejects(
    promoteDeployment(config, transport({}, 'failed').dependencies),
    /Promotion failed/,
  );
});
test('a queued or pending promotion must complete within the deadline', async () => {
  await assert.rejects(
    promoteDeployment(config, transport({}, 'pending', true).dependencies),
    /timed out/,
  );
});
test('API failures do not disclose response bodies or credentials', async () => {
  await assert.rejects(
    promoteDeployment(config, {
      fetchImpl: async () => new Response(config.token, { status: 403 }),
    }),
    { message: 'Vercel API returned HTTP 403' },
  );
});
test('rejects foreign origins before any authenticated request', async () => {
  await assert.rejects(
    promoteDeployment(
      { ...config, deploymentUrl: 'https://example.com' },
      {
        fetchImpl: async () => assert.fail('No request allowed'),
      },
    ),
    /Invalid release configuration/,
  );
});
