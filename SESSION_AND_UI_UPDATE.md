# Saved sign-in, product entry, collection views and themes

## Deploy this release

Deploy **both** the updated backend and frontend. Existing deployments do not change until redeployed. No production credentials or data are included in the source archives.

1. In the backend Vercel project, keep the existing private MongoDB credentials and stable signing/encryption keys. Confirm `STATE_STORAGE=mongodb` and the intended `MONGODB_DB`. Do not regenerate keys for this update.
2. Set backend `ALLOWED_ORIGINS` to the exact frontend origin(s), without a path or trailing slash. For example: `https://anvilforge-frontend-two.vercel.app`. Keep all SMTP, Cloudinary and database secrets only in the backend environment.
3. Redeploy the backend with the updated `server/` folder, including `persistentSessions.mjs`. New saved-session records are added automatically through the existing MongoDB state storage; no manual data migration or reset is needed.
4. In the frontend project, set `VITE_API_URL` to the actual backend API URL, for example `https://appforge-backend.vercel.app/api`. Keep Root Directory `frontend` (or `.` for a separate frontend repository), Node 24.x, and Build Command `pnpm build:production`.
5. Redeploy the frontend with its updated `scripts/`, `src/`, `public/`, `index.html` and Vite configuration. The build creates `.vercel/output/config.json`: `/api/*` is forwarded to the backend **before** the static app fallback. Do not replace the generated routes with an old SPA-only rewrite.
6. Open the frontend and sign in once, complete MFA if asked, and leave **Keep me signed in for 1 week** selected. In the MFA step, select **Remember this device for 1 week** if this is a trusted browser. Repeat for `/owner` because owner and workspace authentication are separate.

Use the same frontend hostname and normal browser profile when returning. A preview deployment, another browser profile, private browsing, or clearing cookies does not share the saved sign-in. Backend Deployment Protection must permit requests from the frontend proxy; do not add a protection bypass secret to frontend code.

If Google/Microsoft mailbox OAuth is enabled, set backend `PUBLIC_API_URL` to `https://YOUR-FRONTEND/api` and register that exact `/email/oauth/callback` URL with the provider. The OAuth binding cookie and callback must use the same first-party host. Ordinary SMTP is unaffected. Keep `VITE_API_URL` pointed at the actual backend, not back at the frontend (which would create a routing loop).

Vercel documents external rewrites as a way to proxy an external service without changing the browser's URL: [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

## How sign-in behaves

| Control                                             | Behavior                                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep me signed in for 1 week                        | Persists the completed login through tab closure and browser restart, up to a fixed seven-day deadline. Selected by default on server login. |
| Remember this device for 1 week                     | After successful MFA, skips another MFA prompt on password sign-in for seven days. This is separate from keeping a login active.             |
| Log out                                             | Revokes the saved login and its related access sessions. It leaves MFA device trust intact. A password is required next time.                |
| Password/MFA reset, disabling or locking an account | Backend account/security checks prevent saved sessions from bypassing these restrictions.                                                    |
| Local browser-only mode                             | Its existing encrypted-vault and 30-minute idle policy are unchanged. Saved server sign-in requires the backend.                             |

The browser holds a high-entropy opaque credential in a persistent HttpOnly cookie (Secure in production, SameSite=Lax, host-only, and scoped to the relevant authentication path). Only its hash, account/version, expiry and related session identifiers enter the backend database. It is never placed in JSON responses or browser local storage. Owner and workspace cookies are separate.

Access JWTs remain short-lived: 15 minutes for owner and 30 minutes for workspace. The frontend renews them against the saved-session cookie without extending the original seven-day expiry. Cookie-authenticated requests require an approved Origin; MFA enrollment-only sessions cannot create a persistent login. When MongoDB state storage is configured, session records survive function restarts and are shared across Vercel instances. The SQLite query engine used internally runs in memory in this mode; it is not the durable database.

Cookies have both Max-Age and Expires. Browser JavaScript cannot read HttpOnly cookies; see [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie). An explicit logout also records a non-secret signed-out flag, preventing automatic restoration if logout happens while offline.

## Product entry and display options

- In a quotation, click a **Product / service title**, type a name and choose **Create product** at the bottom of the inventory dropdown.
- Complete its category, SKU, description, price and stock details, then choose **Create & add to quotation**. It saves the catalog record and fills the selected line without changing its quantity or the rest of the quotation draft. Save the quotation separately when ready.
- Products and Customers now offer **List** and **Tiles**. Search and filters work in both views; the choice is remembered for that browser. Names open existing records for editing, and existing deletion confirmations remain in place.
- Use the sun/moon button in the header or login screen to switch themes. Workspace and owner **Settings → Appearance** offer **Light**, **Dark** and **System**. This is a browser preference and is shared between the portals on that origin. Quotation/PDF colors remain independent of app theme.

## Verify after deployment

1. Sign in as a workspace user, verify MFA and select both remember options. Close the tab, reopen the frontend, then fully close/reopen the browser: the workspace should restore without another password prompt.
2. Log out explicitly and refresh: it must remain on login. Sign in with the password: no MFA prompt should appear while device trust remains valid.
3. Repeat in `/owner`; logging out there must return to Owner sign-in and must not revoke the workspace login.
4. Inspect cookie **names and flags only** in browser developer tools. Under the frontend hostname, look for `patra_session_workspace` / `patra_session_master` and `patra_trust_workspace` / `patra_trust_master`. Confirm HttpOnly, Secure and an expiry roughly seven days from creation. Do not copy or share cookie values.
5. Confirm browser requests use `https://YOUR-FRONTEND/api/...`. If they still call the backend directly, the frontend is running an older bundle. If `/api/health` returns the HTML login page, the proxy rewrite was omitted or an old routing override remains.
6. Create a product from a quotation with a quantity above one. Confirm the quantity stays unchanged, the new price is used, and the product appears in the catalog. Test both customer/product views, refresh, then switch themes and open the PDF preview.

## Regression coverage

- `pnpm test`: frontend/domain unit tests, including restored-session race handling, short-token renewal, the fixed deadline and production API routing.
- `pnpm test:backend`: authentication, MFA/device trust, MongoDB persistence, two-instance Vercel routes, revocation and other backend regressions.
- `pnpm typecheck` and `pnpm lint`.
- `pnpm exec playwright test --config tests/features.config.ts`: isolated temporary test accounts and workspace on ports 3216/5188; requires a working Playwright Chromium installation. It never reads deployment credentials. Test-only recovery codes are written under ignored `test-results/`.

This release was checked with real local UI interactions for workspace/owner tab closure, explicit logout, retained MFA trust, product insertion and both collection views, and with isolated HTTP/MongoDB fixtures. Deployment-specific browser restart behavior still needs the checks above on your actual Vercel hostname. The automated Playwright browser could not launch in this workstation's restricted process environment; its end-to-end suite is included for CI rather than reported as passing here.
