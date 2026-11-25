# Anvil Technologies Business Forge Platform — Frontend

This folder can be installed and deployed independently of `backend/`. It includes its own dependency manifest, lockfile and build configuration. Use this folder as the Vercel project root, or copy its contents into a dedicated frontend repository.

## Deploy to Vercel

- Root Directory: `frontend` (or `.` if this folder is its own repository)
- Framework preset: Vite or Other
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build:production`
- Output directory: `dist`
- Node.js: 24.x
- Build environment: `ENABLE_EXPERIMENTAL_COREPACK=1` (uses the pinned pnpm version)

The included [`vercel.json`](vercel.json) sets the install, build and output paths explicitly. If Vercel reports “No entrypoint found,” check that the Vercel project's Root Directory is `frontend`, not `backend` or the repository root. Redeploy after changing this setting.

No backend secrets are needed in Vercel. To use one central server for every user, add `VITE_API_URL` to the Vercel project's environment variables, for example `https://api.example.com/api`, then redeploy. The regular login page will use that API automatically. The one-time installation-owner setup page is available directly at `/owner`; it is not shown as an option on the login page.

Set `VITE_API_URL` in Vercel for the environment being deployed, then deploy. The production build automatically generates enforced CSP for that exact backend origin in `.vercel/output/config.json` and places the built site in `.vercel/output/static`. Vercel recognizes this Build Output API artifact after the build. There is no manual CSP generation or domain edit in `vercel.json`. `pnpm security:configure` optionally previews the generated policy. Both `pnpm build` and `pnpm build:production` run the same validated production build and generate the Vercel output.

If an older release failed with “Generate and review enforced CSP,” replace the old frontend files with this version and redeploy. Remove any manually added CSP headers or rewrites from the old `vercel.json`; use the included file. Use `pnpm build:production` as the Build Command; `pnpm build` is now a compatible alias. Missing or invalid `VITE_API_URL` still fails with a clear error, and frontend secret variables remain forbidden.

If the build says “Only VITE_API_URL is approved,” the older check rejects Vercel’s automatically added public metadata too. This release accepts known `VITE_VERCEL_*` metadata and embeds only the API URL. Other unsupported `VITE_*` keys produce an error listing names, never values; keep provider secrets in the backend project. Replace the entire frontend folder, including `scripts/` and `package.json`, then use Build Command `pnpm build:production`. The log should run `node scripts/build-production.mjs`.

Saved login images, sizes and appearance now load before sign-in and refresh across visible browsers every five seconds, with immediate refresh on focus/reconnect. Deploy the matching backend as well: its public branding response supplies the complete design while private data remains authenticated. Workspace/owner forms preserve unsaved drafts; local-only mode does not synchronize across browsers.

The backend must allow this site's exact HTTPS origin in its `ALLOWED_ORIGINS` setting. If you use both the Vercel domain and a custom domain, allowlist both origins on the backend.

## Run locally

```sh
pnpm install
pnpm dev
```

This starts the Vite development server. For shared accounts and cross-device business data, deploy the separate backend folder and connect to it in the app. For full instructions, see [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) in the combined repository.

For both projects on Vercel, use the included [Vercel deployment guide](VERCEL.md).

## Saved sign-in and new interface controls

Deploy both updated projects to enable the seven-day saved login and first-party MFA cookies. See [the release guide](SESSION_AND_UI_UPDATE.md) for settings and verification steps.
