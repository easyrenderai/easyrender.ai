# easyrender mobile

Expo (React Native) app for easyrender. Photograph a product, get the free preview, build the 3D model, rotate it in the app and open it in AR. It talks to the same API, accounts and credits as the web app; it adds no backend of its own.

| Tab / screen      | What it does                                                                                                                  | API                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sign in / sign up | Email and password (Better Auth). The session cookie is kept in the device keychain.                                          | `POST /api/auth/sign-in/email`, `/sign-up/email`, `GET /api/auth/get-session`               |
| Library           | Your catalog and credit balance, polled while anything is building.                                                           | `GET /api/renders`                                                                          |
| Capture           | Camera or photo library, downscaled to under 4 MB, uploaded for the free preview.                                             | `POST /api/renders`                                                                         |
| Product           | Free preview, build 3D (price from the quote), angle sheet (counts toward the 3D price), 3D viewer, AR, share, public toggle. | `GET /api/renders/:id`, `/render`, `/sheet`, `/model`, `/preview`, `PATCH /api/renders/:id` |
| Account           | Credits, link out to buy more, sign out.                                                                                      |                                                                                             |

The 3D viewer is Google's `<model-viewer>` (same version as the web app) in a WebView. The app downloads the GLB with the session cookie and hands it to the viewer, so private models are never exposed by URL. AR opens Android Scene Viewer or the web page on iOS, and needs a public link, so the app asks before making a model public.

## Run it

This app is deliberately **not** a Bun workspace of the monorepo: React Native needs exactly one copy of `react` and `react-native`, and the web app pins a different React patch. It has its own lockfile.

```sh
cd apps/mobile
bun install
cp .env.example .env     # optional: EXPO_PUBLIC_API_URL, defaults to https://easyrender.ai
bunx expo start          # scan the QR code with Expo Go, or press a / i for an emulator
bun run typecheck
```

For local API development set `EXPO_PUBLIC_API_URL` to your machine's LAN address (for example `http://192.168.1.20:3000`).

## Release pipeline

Two GitHub Actions workflows live in `.github/workflows/`:

- **Mobile CI** runs on pull requests that touch `apps/mobile`: typecheck, lint, Android bundle.
- **Mobile release** runs by hand only (Actions, Mobile release, Run workflow; pick the platform and the Google Play track). It starts a production build on [EAS](https://expo.dev/eas) for iOS and Android and has EAS submit each finished build: **iOS to TestFlight, Android to Google Play's internal track**. Build numbers are managed by EAS. Promoting a build to the public App Store or the Google Play production track stays manual, so nothing goes live without a review step.

The job only starts the builds (`--no-wait`); progress and logs are on the EAS dashboard. If the store credentials below are missing, the job still builds and skips the submit, with a warning.

### One-time setup

1. **Expo.** Create an account (or org) at expo.dev and a project with slug `easyrender`. Create an access token (Account settings, Access tokens).
2. **Apple.** Apple Developer Program membership. In App Store Connect go to Users and Access, Integrations, App Store Connect API, and create a team key with the App Manager role. Download the `.p8` once and note the Key ID and Issuer ID. Note the Team ID from developer.apple.com, Membership. The first run registers the bundle id `ai.easyrender.app` for you; after that create the app in App Store Connect with that bundle id (the workflow finds it by bundle id, or set `ASC_APP_ID`).
3. **Google.** Google Play Console, create the app (package `ai.easyrender.app`). In Google Cloud create a service account, enable the Google Play Android Developer API, create a JSON key, and invite the service account in Play Console under Users and permissions with release permissions. Upload the first build by hand: Google Play only accepts API uploads once the app has had a first release.
4. **GitHub.** Add these to the repo (Settings, Secrets and variables, Actions), or with `gh`:

```sh
gh secret set EXPO_TOKEN
gh secret set ASC_API_KEY_P8 < AuthKey_XXXXXXXXXX.p8
gh secret set PLAY_SERVICE_ACCOUNT_JSON < play-service-account.json
gh variable set EAS_PROJECT_ID --body <project id from the Expo project page>
gh variable set EXPO_OWNER --body <expo account or org name>   # only if not the token's own account
gh variable set ASC_KEY_ID --body <key id>
gh variable set ASC_ISSUER_ID --body <issuer id>
gh variable set APPLE_TEAM_ID --body <team id>
gh variable set APPLE_TEAM_TYPE --body COMPANY_OR_ORGANIZATION   # or INDIVIDUAL
gh variable set ASC_APP_ID --body <numeric app id>               # optional
```

Keys never go in the repo: the workflow writes them to git-ignored files on the runner. Manual runs of the release workflow can also pick the Google Play track (`internal`, `alpha`, `beta`, `production`).

### iOS builds with Xcode (no Expo account)

`.github/workflows/mobile-ios.yml` builds the iOS app with Xcode on a GitHub macOS runner. Pull requests that touch `apps/mobile` compile it for the simulator, which needs no secrets. Run it by hand (Actions, Mobile iOS (Xcode), Run workflow, `upload` on) to sign it and send it to TestFlight. Xcode creates the signing certificate and provisioning profile itself with the App Store Connect API key, so the key needs the **Admin** role (App Manager cannot create certificates). It needs `ASC_API_KEY_P8` (secret) and `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID` (variables) from the setup above; the app record with bundle id `ai.easyrender.app` must exist in App Store Connect first. The build number is the workflow run number. Android is not covered by this workflow.

Test builds without the stores: `bunx eas-cli build --platform all --profile preview`.

## Error monitoring (Sentry)

`lib/sentry.ts` starts `@sentry/react-native` from the root layout and wraps it with `Sentry.wrap`.
It is off until `EXPO_PUBLIC_SENTRY_DSN` is set for the build. `eas.json` sets it for every build
profile (the DSN is public, project `easyrender-mobile` in the `easyrenderai` Sentry org, separate
from the web project). The SDK is native code, so it
needs a new EAS build; Expo Go and OTA updates are not enough. Source maps and readable native
stack traces need the Sentry Expo config plugin and Metro plugin plus `SENTRY_AUTH_TOKEN` as an
EAS secret; that is not wired yet.

## Known limits

- Buying credits opens the website. Apple and Google require their own billing for digital goods bought inside an app, so check the store policies before shipping paid credits in the app.
- iOS AR goes through the web page in Safari (Quick Look); Android uses Scene Viewer directly.
- The shared types in `lib/api.ts` mirror `RenderView` from `@easyrender/core` by hand.
