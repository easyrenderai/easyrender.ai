# Official automation integration listings

Prepared against official documentation on **2026-11-16**. This PR supplies local
packages and submission material. It does not make easyrender listed, verified or
endorsed. Nothing has been published, pushed to an automation platform, or submitted
for review. Accounts have not been created. Release steps below are for a future,
separately authorized release owner.

## Shared release prerequisites

1. Review this PR; deploy its REST `image_url` support through the normal release process
   before live connector testing. Do not merge solely to publish the integrations.
2. Confirm production `/api/openapi.json` documents `CreateRenderJson.image_url`.
   Use [API documentation](../api.md) and the [OpenAPI endpoint](https://easyrender.ai/api/openapi.json)
   in reviewer materials. Test with owned product photos and an authorized easyrender key.
3. Review the package README for each platform. Create Render starts a private **free
   preview**, not a finished model. A build needs separate authorization in easyrender.
   Model Ready watches one selected render ID; it is not an account-wide completion feed.
4. Use the easyrender name, homepage `https://easyrender.ai`, and the supplied brand icon.
   Supply a monitored support contact, currently `info@easyrender.ai`, privacy policy
   `https://easyrender.ai/privacy`, and terms `https://easyrender.ai/terms`.
5. Keep API keys only in platform credential stores. The needed scopes are `read` and
   `write`; dedicated modules do not require spending or sharing permissions. Make's
   universal module follows the scopes of the endpoint explicitly chosen by the user.
6. Capture live success/error evidence in each platform before requesting review.
   Local builds, mocks and JSON checks do not demonstrate hosted runtime compatibility.

## n8n: npm package → verified community node

**Accounts:** easyrender-owned GitHub maintainer access, an npm account with publishing
rights to `n8n-nodes-easyrender`, and an n8n Creator Portal account. A local n8n instance
is sufficient for development; Cloud discovery needs verification.

1. Check the npm name and existing n8n directory entries before release. Do not create a
   duplicate integration if one already exists. Confirm public repository visibility
   and maintainer identity match npm metadata.
2. From `integrations/n8n`, run `npm ci`, `npm run lint`, `npm test`, and
   `npm pack --dry-run`. Inspect the tarball file list for both nodes, credentials,
   icons, README and MIT license. Test using `npm run dev` and the README workflow.
3. Prepare a **manual GitHub Actions publishing workflow** using the example below.
   It is documentation only; this PR does not install an active publish workflow.
   Review and pin action revisions according to repository policy before enabling it.
4. For an existing npm package, configure its **Publish access → Trusted Publishers →
   GitHub Actions** with owner `easyrenderai`, repository `easyrender.ai`, and the exact
   workflow filename. For the first publish, when no package settings exist yet, use
   an appropriately scoped npm granular publishing token as a GitHub secret; publish
   from Actions with provenance, then configure trusted publishing and remove the token.
5. After explicit release approval, run that workflow for the reviewed commit. Verify
   the npm package, source repository, files, and provenance attestation. Publishing
   from a laptop does not meet the current verification requirement.
6. Run the official published-package scanner:
   `npx @n8n/scan-community-package n8n-nodes-easyrender`.
7. Log into [n8n Creator Portal](https://creators.n8n.io/nodes), submit the npm package
   for verification, and provide documentation and requested ownership information.
   Address reviewer findings and resubmit an updated version as needed.
8. Only after approval verify discovery in n8n's node panel, including Cloud. npm
   availability alone is not n8n verification or a core/built-in integration.

These steps follow the [submission procedure](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes.md)
and [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md).
The package uses the official CLI, TypeScript, MIT, English copy, no runtime dependencies,
and no node access to filesystem or environment variables. Since May 1, 2026,
verification requires GitHub Actions publication with npm provenance.

Example future workflow (`.github/workflows/publish-easyrender-n8n.yml`):

```yaml
name: Publish easyrender n8n
on:
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm-release # Configure required reviewers before enabling.
    defaults:
      run:
        working-directory: integrations/n8n
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
          package-manager-cache: false
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm publish --provenance --access public
        # First publication only: add NODE_AUTH_TOKEN from a GitHub Actions secret.
        # Once trusted publishing is configured, use OIDC without a long-lived token.
```

Increment the package version and refresh its lockfile before each subsequent release.
Do not add tag/push-based automatic publishing as part of this preparation PR.

## Zapier: private app → reviewed beta → public

**Accounts:** a Zapier developer account controlled by easyrender, at least one integration
admin using the company's domain, and easyrender test access. Publishing requirements
also call for a non-expiring easyrender support test account using
`integration-testing@zapier.com`, with required features accessible. Provision it only
in the later authorized release process; share credentials privately with reviewers.

1. In `integrations/zapier`, use Node.js 22 and run `npm ci`, `npm test`,
   `npm run validate`, and `npm run build`. The local validation skips remote style checks.
2. When authorized, authenticate and register/link exactly one integration:

   ```sh
   npx zapier-platform login
   npx zapier-platform register "easyrender"
   # If easyrender already has an integration, use link instead of register:
   # npx zapier-platform link
   npx zapier-platform push
   ```

   Keep generated `.zapierapprc` out of this PR. Initial pushes are private; pushing is
   not a public launch. CLI v19 uses `zapier-platform`; old instructions may say `zapier`.
   See the [CLI guide](https://docs.zapier.com/integrations/build-cli/overview).
3. Add company maintainers and invite testers from the Developer Platform. Connect keys,
   turn on Zaps covering every action and trigger, and retain successful history.
   Test the watcher with a pending selected render; an already-ready test item may be
   seeded into Zapier's deduplication cache. Exercise revocation, errors and pagination.
4. Complete branding, homepage, support/API documentation, and reviewer test access.
   Use English field descriptions, a non-secret account label, production endpoints,
   and company ownership evidence. Run `npx zapier-platform validate --fail-for-publishing`
   with platform access and resolve all blocking publishing tasks.
5. In **Developer Platform → integration → Integration Home → Publish**, complete the
   form and **Submit for Review**. It remains private while review is pending.
6. Approval places the integration in the directory as **Beta**. The current guide
   specifies a 90-day public beta before the Public status. It also documents an early
   exit after a qualifying signup through an embedded Zapier tool. This is not a
   guaranteed approval or a requirement to manufacture test users.
7. During beta publish support documentation, create useful Zap templates, monitor errors,
   and resolve feedback. After the status changes to Public, verify the directory page
   and remove beta wording from your own materials.

Review the [publishing requirements](https://docs.zapier.com/integrations/publish/integration-publishing-requirements)
and [launch/beta procedure](https://docs.zapier.com/integrations/publish/public-integration)
at submission time. Do not substitute older fixed-user-count rules for the current process.

## Make: custom app → publication → review → directory

**Accounts:** an easyrender-owned Make account with Custom Apps access, its testing
organization/team, and easyrender test credentials. Use a contact authorized to
represent the API vendor and support the integration.

1. Follow [the assembly instructions](../../integrations/make/README.md). Paste each
   panel separately; `app.json` is not an importable scenario blueprint.
2. Run every module in private test scenarios, including the universal API call, a
   multi-page list, completion polling, and an intentional authentication error.
   Retain fresh execution logs and remove personal data and secrets from review evidence.
3. Check sanitization, errors, field labels, dates, limits and pagination against
   [Make's prerequisites](https://developers.make.com/custom-apps-documentation/app-review/prerequisites).
   Local JSON tests are not Make's IML validator; resolve builder/runtime errors first.
4. After separate publication approval, remove temporary test components, open the app's
   code and click **Publish**. Set intended modules visible in **Modules**. Publishing
   cannot be undone and does not itself make the app approved for all Make users.
5. Open **Review**, add API docs and recent test-scenario links, then **Request review**.
   Complete the follow-up developer/vendor relationship, partnership/support contact,
   category, logo, service URL and compliance form.
6. Resolve automatic and manual QA feedback; rerun scenarios after fixes so reviewers
   have fresh logs. Follow the review email thread and **App flow/Review** status.
7. Wait for approval and release confirmation, then verify the public directory entry.

See [Request app review](https://developers.make.com/custom-apps-documentation/app-review/request-app-review)
and [review statuses](https://developers.make.com/custom-apps-documentation/app-review/review-status).

## English listing copy

Use `easyrender` as the application name. These descriptions intentionally avoid
pricing, allowance and plan claims, engine-vendor names, and unearned endorsement claims.

### n8n

**Short:** Connect product photos to easyrender previews and 3D model workflows in n8n.

**Long:** Create a private free preview from a product image URL, retrieve render status,
list your renders, and read your account balance. Watch a selected render and continue
your workflow when its 3D model is ready. Connect catalog and content workflows to
easyrender using an API key. Preview creation and 3D building are separate steps, so
you can review the result before starting a build in easyrender.

### Zapier

**Short:** easyrender is a product visualization tool that turns product photos into 3D models and AR-ready assets.

**Long:** easyrender helps teams prepare product visuals from a single photo. Create a
private free preview from an image URL, look up a render, list existing renders, and
check your account balance. Watch a selected model for completion and connect its
status to your catalog or content workflow. Review previews and authorize 3D builds
separately in easyrender.

### Make

**Short:** Automate product preview creation and selected-model readiness workflows with easyrender.

**Long:** Connect easyrender to your product operations. Create private free previews
from image URLs, retrieve render status, list renders, and read your account balance.
Watch a selected render until its model is ready, or make an authorized API call for
an advanced workflow. Review each preview and start its 3D build separately in
easyrender before continuing to delivery.
