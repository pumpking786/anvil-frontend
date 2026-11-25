# Deploy the frontend and backend to Vercel

The November 4 update adds the backend function entry point, bounded transfers for large requests/responses, shared MongoDB rate limits, and Vercel proxy handling. The same backend still starts on Render with `pnpm start`. The official Vercel Node builder successfully packaged the Node 24 function without private files. Local tests exercise cold-start recovery, two application instances, large workspace saves, authentication, and quotation email retries with simulated providers. A live Vercel preview and real provider checks remain required; this guide does not claim they have been run.

The November 5 frontend update generates enforced CSP and page routing automatically during the Vercel build from `VITE_API_URL`. No manual CSP generation or domain-specific committed configuration is required. Verification covers the automated frontend/backend suites, a standalone production build with Vercel metadata, official Vercel static-builder recognition of Build Output API v3, and local browser checks of workspace/owner branding before login and live updates. The prior release also checked login refresh and PDF generation with no CSP violations. Live Vercel/provider verification remains separate.

The frontend also accepts the public framework metadata that Vercel injects (for example, `VITE_VERCEL_ENV` and `VITE_VERCEL_URL`). Only `VITE_API_URL` is embedded as application configuration. Unsupported `VITE_*` variables still stop the release, but the error now lists their names without their values. Never prefix database, SMTP or Cloudinary credentials with `VITE_`.

Use any frontend and backend domains you choose. The examples below are placeholders, not assigned domains. Keep the backend and frontend in separate Vercel projects, even if both come from one Git repository.

## 1. Import the backend

| Setting          | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Root Directory   | `backend` in the combined repository; `.` in a backend-only repository |
| Framework Preset | Other                                                                  |
| Node.js version  | 24.x                                                                   |
| Install Command  | `pnpm install --frozen-lockfile`                                       |
| Build Command    | Leave empty; the checked-in `vercel.json` configures this              |
| Output Directory | No override                                                            |
| Start Command    | None on Vercel                                                         |

The function is `api/index.mjs`. The included `vercel.json` forwards `/api/*` to that function and sets a 300-second maximum duration. Do not use `pnpm start` as the Vercel build command. That command is for Render and local servers.

Add `ENABLE_EXPERIMENTAL_COREPACK=1` to **both Vercel projects** so their builds use the pinned pnpm version in `package.json` ([Vercel package manager configuration](https://vercel.com/docs/builds/configure-a-build#corepack)).

## 2. Add private backend environment values

Copy the existing installation's values from your private hosting settings. Do not upload `.env`, private credential files, or database backups. The function reads only hosting environment variables.

| Variable                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `NODE_ENV`              | `production`                                                                   |
| `STATE_STORAGE`         | `mongodb`                                                                      |
| `MONGODB_URI`           | Your private Atlas / replica-set URI with verified TLS                         |
| `MONGODB_DB`            | The database containing the intended installation                              |
| `WORKSPACE_JWT_KEY`     | Existing workspace signing key                                                 |
| `OWNER_JWT_KEY`         | Existing owner signing key                                                     |
| `MFA_ENCRYPTION_KEY`    | Existing MFA encryption key                                                    |
| `EMAIL_ENCRYPTION_KEY`  | Existing email encryption key                                                  |
| `API_TOKEN`             | Existing private setup key                                                     |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary account                                                        |
| `CLOUDINARY_API_KEY`    | Private Cloudinary key                                                         |
| `CLOUDINARY_API_SECRET` | Private Cloudinary secret                                                      |
| `CLOUDINARY_FOLDER`     | The installation's existing asset folder                                       |
| `ALLOWED_ORIGINS`       | Exact frontend origin, e.g. `https://your-frontend.vercel.app`                 |
| `PUBLIC_API_URL`        | Exact backend URL ending in `/api`, e.g. `https://your-backend.vercel.app/api` |
| `CSP_REPORT_ONLY`       | `false`                                                                        |

The four signing/encryption keys must be distinct canonical base64-encoded 32-byte values. **Keep existing keys when deploying an existing database** so accounts, MFA and mailbox credentials remain readable. Never generate keys during a deployment. For a new installation, generate each key privately once and retain it in the secret manager.

No `DATA_DIR` or persistent local disk is required in full MongoDB mode. Do not set `VERCEL`, `PATRA_TEST_*`, or fake proxy IPs yourself. Vercel supplies its runtime identity and trusted forwarding headers. `TRUST_PROXY` / `TRUSTED_PROXY_IPS` are only needed for your separately hosted Node service, not the Vercel function.

Atlas must permit connections from the deployment environment, with a database user that can read/write and create the application's indexes. Prefer restricted networking/static egress where available. Preserve certificate verification. Use a separate staging database for deployment tests and outage exercises.

For SMTP, also add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, and optionally `SMTP_FROM_NAME`. Use the provider's supported TLS port (465, 587, or 2525). SMTP verification and sending remain backend-only. OAuth configuration remains available through the authenticated Owner Portal; register callbacks using the new backend domain.

If you have these values in a private shell environment, `pnpm vercel:check` from the backend folder validates the configuration without connecting to providers or printing credentials. Redeploy after changing hosting environment values.

## 3. Import and connect the frontend

1. Import a second Vercel project with Root Directory `frontend` (or `.` for the frontend-only repository), Vite framework, Node 24.x, install `pnpm install --frozen-lockfile`, build `pnpm build:production`, output `dist`.
2. Set the frontend project's public API build variable: `VITE_API_URL=https://your-backend.vercel.app/api`. Put no MongoDB, Cloudinary, SMTP or encryption secrets in this project.
3. Deploy using the included `frontend/vercel.json`. The production build generates `.vercel/output/config.json` with the exact backend origin in CSP, and places the built site in `.vercel/output/static`. Vercel automatically detects this [Build Output API](https://vercel.com/docs/build-output-api) artifact after the build. The normal `dist` folder remains available for local preview.
4. Set backend `ALLOWED_ORIGINS` to the resulting frontend origin, with no path or trailing slash. Multiple approved origins use commas. Set `PUBLIC_API_URL` to the backend domain ending in `/api`. Redeploy both projects after completing these values.
5. If upgrading from the manual CSP configuration, replace the old `frontend/vercel.json` with the included file and remove any custom CSP header overrides. Do not run a separate header-generation command. `pnpm security:configure` is now an optional policy preview only.

Deploy the updated backend first, then the matching frontend. The updated frontend understands large transfers; an older frontend can still exceed Vercel's body limit. Changing a domain requires updating these environment settings and any OAuth callbacks, then rebuilding; the frontend policy updates automatically, so the application code does not need a domain rename.

## 4. Verify the deployment

Open `https://your-backend.vercel.app/api/health`. Expected response:

```json
{ "status": "ok", "transport": "parts-v1" }
```

Sign in through the frontend. Confirm refresh, MFA, owner access, a customer/product save, quotation PDF download, and a controlled quotation email. In `/owner`, run the actual MongoDB, Cloudinary and SMTP connection tests. Successful health output alone does not prove email or image-provider access.

An existing MongoDB installation retains its owner account. Do not recreate it. For a **new, empty installation**, use the backend's `pnpm master:create --email owner@your-company.com` from a trusted computer or administrative runner with that installation's private environment. Vercel has no persistent interactive service shell. The command writes a private temporary credential file locally; change the temporary password, enroll MFA, then remove that file. Never run account provisioning as a frontend or deployment build step.

## Login branding and live updates

Deploy both updated folders. The public `/api/public/branding` endpoint now supplies the saved login logo, proportional sizing, background, layout, colors and text before authentication. It only projects public branding fields; accounts, MFA, contacts and integration credentials stay protected. Workspace login branding remains available even if the owner chooses an independent owner logo.

Visible login pages and owner workspace configuration refresh every five seconds, and immediately on focus or reconnect. Same-browser branding saves notify other open tabs. An application revision query avoids downloading unchanged branding, using a CORS-enabled `204` instead of HTTP `304`; overlapping requests are coalesced and late responses cannot replace a newer save. Workspace records continue to use authenticated revision notifications. Open settings forms accept changes only while clean; unsaved drafts are preserved. Local-only workspaces remain specific to their browser. Integration health retains its separate refresh cadence to avoid repeatedly contacting email and image providers.

To verify, save a login design in workspace customization, open the same frontend URL in a fresh browser without signing in, and check the logo, background, layout and sizes. Change and save the design in the first browser: the second visible login page should update within five seconds plus request time. Repeat at `/owner`, including an image removal. Backend `ALLOWED_ORIGINS` must include that frontend origin.

## How larger payloads work

- Bodies larger than 2 MiB are transferred as authenticated 1 MiB parts, below Vercel's 4.5 MB HTTP limit even after base64 encoding. Large authenticated JSON responses use the same mechanism and preserve their revision/ETag. Run Owner Portal image sync for an existing installation that still has inline branding images; public login branding must use Cloudinary URLs to stay small.
- Temporary parts are AES-GCM encrypted with a derived key and stored in MongoDB's `temporary_transfers` / `temporary_transfer_parts` collections. They are bound to the account **and current login session**, expire after 15 minutes, and have TTL indexes for cleanup. They are never placed in public Cloudinary URLs.
- Each final operation still uses the original validation, roles, MFA requirements, revision checks, and email idempotency key. Partial or expired uploads cannot submit a quotation email. Logging out prevents access to that session's transfers.
- The existing application limits remain: 25 MiB logical request, 12 MiB PDF attachment, and MongoDB's existing per-record limit. Transfers are limited per account to 30 starts per minute and 150 MiB per 15 minutes; request limits are shared across instances. Exceeding a limit returns `429` with a retry delay.
- Business records, users, MFA and logs remain in MongoDB. Temporary transfers and `request_limits` counters are separate expiring collections. Existing SQLite compatibility queries run only in memory in MongoDB mode.
- Warm instances reuse a small MongoDB connection pool. Every application request reads a fresh versioned snapshot; concurrent stale writes fail instead of overwriting newer changes. Workspace revision notifications use bounded polling responses.

The existing snapshot storage adapter still reads the application state per request. Benchmark large workspaces and concurrency on staging before scaling; this change does not claim an entity-level storage redesign or unlimited capacity. Transfer tests use transactional fixtures, so they do not replace an Atlas restore/load test.

## November 5 CORS and revision correction

Both folders must be deployed for this correction. The public branding refresh no longer sends `If-None-Match`: Vercel was returning a `304` without the allowed-origin header. The backend now returns `X-Patra-Brand-Revision`, and `?since=<revision>` gets a normal `204` when unchanged. Both `200` and `204` keep the approved CORS origin.

Workspace/user responses now expose `X-Patra-Revision` so compression cannot turn the database version into an unusable HTTP weak ETag. The frontend uses that exact version in `If-Match`. Numeric weak tags from older Patra releases are supported as a fallback. Genuine stale writes still return `412` without an automatic retry.

For the reported deployment, frontend `VITE_API_URL` is `https://appforge-backend.vercel.app/api` and backend `ALLOWED_ORIGINS` includes `https://anvilforge-frontend-two.vercel.app`. The live normal response already allowed this origin; adding a wildcard is not needed. Deploy the updated backend, then frontend, and reload open app tabs once to load the new client. Confirm a user can be created and the next request uses a quoted numeric `If-Match` without `W/`.

## Troubleshooting

| Symptom                                    | Check                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only VITE_API_URL is approved              | Replace the old frontend with this release. Known Vercel metadata is supported; remove any other unsupported `VITE_*` keys from frontend hosting settings. |
| Login branding appears only after sign-in  | Deploy the matching backend and frontend; check `/api/public/branding` includes `loginBrand`, and verify `VITE_API_URL` and `ALLOWED_ORIGINS`.             |
| No entrypoint found                        | Deploy the updated `backend` folder with `api/index.mjs` and `vercel.json`; select Other, not Vite/Next.js                                                 |
| Backend returns 503 at cold start          | Validate backend environment values with `pnpm vercel:check`; check Atlas access, stable keys, and Vercel runtime logs                                     |
| Origin not allowed / browser network error | Set backend `ALLOWED_ORIGINS` and frontend `VITE_API_URL` to the actual domains; redeploy to regenerate CSP                                                |
| 413 / `FUNCTION_PAYLOAD_TOO_LARGE`         | Update both frontend and backend; verify `transport: parts-v1` in health output                                                                            |
| Transfer expired                           | Reopen the form and retry; do not assume an unconfirmed email was not sent—check its history first                                                         |
| SMTP is configured but cannot send         | Test SMTP in Owner Portal after deployment; verify the sender address, TLS port and provider access                                                        |
| Missing existing accounts/MFA              | Check `MONGODB_DB` and the original four keys; do not reset or reprovision accounts as a deployment workaround                                             |

References: [Vercel Build Output API](https://vercel.com/docs/build-output-api), [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [function limits](https://vercel.com/docs/functions/limitations), [platform request headers](https://vercel.com/docs/headers/request-headers).
