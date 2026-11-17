# Releasing easyrender.ai

Merging to `main` deploys nothing. Production changes only when someone dispatches **Release**.
Vercel's Git integration deploys nothing at all (`git.deploymentEnabled` is false in
`apps/web/vercel.json`): no branch or PR previews. Every deployment comes from the Release workflow
(one production build per run, including stage-only rehearsals) or a person running the CLI.

## Ship a release

1. Merge the changes to `main` through PRs as usual (CI Gate must pass).
2. Bump `version` in the root `package.json` in a PR and merge it. Semver: patch for fixes, minor
   for features, major for breaking API or MCP changes.
3. GitHub Actions, **Release**, branch `main`, tag `vX.Y.Z` (must equal the root version).
   First time through, or after changing the pipeline, tick **stage_only** to rehearse: it builds
   and smokes a production deployment that no domain points at, then stops.

```bash
gh workflow run release.yml --repo easyrenderai/easyrender.ai --ref main -f tag=v0.1.0
```

What the workflow does, in order. A failure before step 5 leaves production as it was.

1. **Verify**: runs `ci.yml` (Biome, UI guards, secrets, typecheck, tests, schema check) on the
   pinned `main` commit.
2. **Backend**, two parts, each skipped when it has nothing to do:
   - The exports converter, when `services/model-export` changed since the previous release and
     `MODEL_EXPORT_DEPLOY_ROLE_ARN` is set: builds and tests the image, pushes it and points the
     Lambda function at it (`model-export.yml`).
   - The storage stack, when `infra/aws` changed since the previous release and
     `AWS_DEPLOY_ROLE_ARN` is set: creates a CloudFormation change set for `easyrenderai-storage`
     and executes it only if nothing is replaced or removed; otherwise it stops for a person
     (`infra/aws/README.md`).
3. **Stage**: `vercel deploy --prod --skip-domain`. Vercel builds with the project's own variables.
   The production build also syncs the database schema (`packages/db/scripts/deploy.mjs`): additive
   changes apply, anything else fails here, before any user sees the release.
4. **Smoke**: `/` and `/api/openapi.json` on the staged URL. The staged build is a production
   build, so `apps/web/proxy.ts` would 301 it to easyrender.ai; `lib/canonical-host.ts` lets the
   deployment's own host (`VERCEL_URL`) through and still redirects www and every other alias.
5. **Promote**: uses the team-scoped Vercel API after checking the staged deployment is READY,
   production-targeted, and belongs to the configured project and pinned commit. It waits for
   that deployment's alias operation to succeed, then smokes production. No rebuild or user-profile
   lookup is needed.
6. **Publish**: creates the tag and the GitHub release (generated notes plus the deployment URL).

The release is not tagged unless it reached production. The crons in `vercel.json` run from the
production deployment, so they switch with the promote.

## Roll back

GitHub Actions, **Rollback**, enter a reason. Empty `target_tag` means the release before the
latest. It promotes the deployment recorded in that release, in seconds. The database is never
rolled back: schema changes are additive, so earlier code keeps working. Fix a bad schema change
forward.

## One-time setup

Everything below lives on the GitHub environment `production`, not in the repo. Nothing in this
list is a secret except the token.

| Name                              | Kind               | Value                                                                                       |
| --------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`                    | secret             | A Vercel token for the `shipshitdev` team that can deploy `easyrender.ai`                   |
| `VERCEL_ORG_ID`                   | variable           | The team id (`.vercel/project.json` after `vercel link`, or Team Settings)                  |
| `VERCEL_PROJECT_ID`               | variable           | The `easyrender.ai` project id (same file, or Project Settings)                             |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | secret, optional   | Optional override; otherwise the smoke fetches or creates the bypass via the `VERCEL_TOKEN` |
| `PRODUCTION_URL`                  | variable, optional | Defaults to `https://easyrender.ai`                                                         |
| `AWS_DEPLOY_ROLE_ARN`             | variable, optional | Output `DeployRoleArn` of `infra/aws/github-deploy-role.yml`. Empty skips the backend job   |
| `AWS_REGION`                      | variable, optional | Defaults to `eu-west-1`                                                                     |

```bash
gh api -X PUT repos/easyrenderai/easyrender.ai/environments/production
gh secret set VERCEL_TOKEN --env production --repo easyrenderai/easyrender.ai
gh variable set VERCEL_ORG_ID --env production --repo easyrenderai/easyrender.ai --body "<team id>"
gh variable set VERCEL_PROJECT_ID --env production --repo easyrenderai/easyrender.ai --body "<project id>"
```

Add required reviewers to the `production` environment if releases should wait for an approval.

AWS role (once, by a person; review the template first):

```bash
aws cloudformation deploy --region eu-west-1 --stack-name easyrender-github-release \
  --template-file infra/aws/github-deploy-role.yml --capabilities CAPABILITY_NAMED_IAM
```

## Not in this workflow

- The mobile app (`apps/mobile`, `mobile-release.yml`) and the desktop shell (`apps/desktop`)
  release on their own.
- Store plugins (`plugins/`) are packaged and submitted by hand.
- Changes to the converter's own stack (`infra/aws/exports.yml`) are still deployed by hand, see
  `infra/aws/README.md`.
