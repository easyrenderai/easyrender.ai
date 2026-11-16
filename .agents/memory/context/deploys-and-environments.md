# Deploys and environments

- Vercel Git integration. Production deploys when a PR merges to `main`; previews build per PR.
  Project root is `apps/web`; the build command is `bun run vercel-build`, which syncs the
  schema (production only) and runs `next build`.
- CI (`.github/workflows/ci.yml`) runs Biome, the UI guard, typecheck and tests on every PR. It
  does not deploy.
- Env vars live in Vercel; `.env.example` lists them all and `turbo.json` `build.env` must list
  every one the build reads.
- Storage: S3 bucket behind CloudFront (`infra/aws/storage.yml`), assumed through the Vercel OIDC
  role (`AWS_ROLE_ARN`). Local dev writes to `.data/`. Objects are written under `renders/`.
  Production stack: `easyrenderai-storage` in eu-west-1, created by running
  `aws cloudformation deploy --stack-name easyrenderai-storage --region eu-west-1
  --template-file infra/aws/storage.yml --capabilities CAPABILITY_IAM` (CloudShell in the console;
  the CLI IAM user cannot read CloudFormation). The Vercel vars `S3_BUCKET`, `AWS_REGION`,
  `AWS_ROLE_ARN` and `ASSETS_CDN_URL` come from the stack outputs. `ASSETS_CDN_URL` is the
  `*.cloudfront.net` address until a custom host is added: redeploy the stack with the `CdnDomain`
  and `CertificateArn` parameters (ACM certificate from us-east-1, DNS validated in Route 53), point
  a CNAME at the `DistributionDomain` output, then switch `ASSETS_CDN_URL`.
- Private files: `renders/*` is public to anyone with the URL. Converted models (OBJ, FBX, BLEND)
  go to the separate exports bucket in the same stack, served only as signed, short-lived links
  under `/exports/*` and deleted after one day. Steps, key handling and rotation:
  `infra/aws/README.md`. Never put a private file on any other path of the distribution.
- Env var changes only reach a deployment built after the change; redeploy or merge to `main`.
- Database: Neon Postgres. Use the unpooled URL for schema syncs.
