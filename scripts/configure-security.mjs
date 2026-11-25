import { fileURLToPath } from 'node:url';
export function vercelConfiguration(apiUrl = '', enforce = false) {
  let apiOrigin = '';
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw Error('Use the actual HTTPS backend API URL without credentials.');
    apiOrigin = url.origin;
  }
  const csp = `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://res.cloudinary.com; font-src 'self' data: blob:; connect-src 'self' data: https://res.cloudinary.com${apiOrigin ? ' ' + apiOrigin : ''}; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
  return {
    installCommand: 'pnpm install --frozen-lockfile',
    buildCommand: 'pnpm build:production',
    outputDirectory: 'dist',
    headers: [
      {
        source: '/(.*)',
        headers: [
          {
            key: enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
            value: csp,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ],
    rewrites: [
      { source: '/owner', destination: '/' },
      { source: '/((?!api(?:/|$)|assets(?:/|$)|.*\\.[^/]+$).*)', destination: '/' },
    ],
  };
}
// Vercel reads this generated artifact AFTER the build, so each deployment gets
// the exact environment's origin without editing a pre-build vercel.json file.
export function vercelOutputConfiguration(apiUrl) {
  const headers = Object.fromEntries(
    vercelConfiguration(apiUrl, true).headers[0].headers.map(({ key, value }) => [key, value]),
  );
  return {
    version: 3,
    routes: [
      { src: '/.*', headers, continue: true },
      {
        src: '/assets/.*',
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        continue: true,
      },
      { src: '/api/(.*)', dest: `${apiUrl.replace(/\/$/, '')}/$1` },
      { handle: 'filesystem' },
      {
        src: '/(?!api(?:/|$)|assets(?:/|$)|.*\\.[^/]+$).*',
        dest: '/index.html',
        methods: ['GET', 'HEAD'],
        headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
      },
    ],
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { loadEnv } = await import('vite');
  const { validateRelease } = await import('./check-production.mjs');
  const env = loadEnv('production', fileURLToPath(new URL('..', import.meta.url)));
  validateRelease(env);
  console.log(JSON.stringify(vercelOutputConfiguration(env.VITE_API_URL), null, 2));
  console.log(
    'Policy preview only. pnpm build:production generates the deployed headers automatically.',
  );
}
