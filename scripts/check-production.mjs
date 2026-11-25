import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { vercelConfiguration } from './configure-security.mjs';
// Vercel injects these public framework metadata keys even when the only
// application setting supplied by the owner is VITE_API_URL.
const vercelMetadata = new Set(
  [
    'ENV',
    'TARGET_ENV',
    'URL',
    'BRANCH_URL',
    'PROJECT_PRODUCTION_URL',
    'REGION',
    'DEPLOYMENT_ID',
    'PROJECT_ID',
    'HASH_SALT',
    'GIT_PROVIDER',
    'GIT_REPO_SLUG',
    'GIT_REPO_OWNER',
    'GIT_REPO_ID',
    'GIT_COMMIT_REF',
    'GIT_COMMIT_SHA',
    'GIT_COMMIT_MESSAGE',
    'GIT_COMMIT_AUTHOR_LOGIN',
    'GIT_COMMIT_AUTHOR_NAME',
    'GIT_PULL_REQUEST_ID',
  ].map((key) => `VITE_VERCEL_${key}`),
);
export function validateRelease(env, config) {
  let api;
  try {
    api = new URL(env.VITE_API_URL);
  } catch {
    throw Error('Set the exact public HTTPS VITE_API_URL before a production release.');
  }
  if (
    api.protocol !== 'https:' ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    api.pathname !== '/api' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)
  )
    throw Error('VITE_API_URL must be the actual HTTPS backend URL ending in /api.');
  const unexpected = Object.keys(env).filter(
    (key) => key.startsWith('VITE_') && key !== 'VITE_API_URL' && !vercelMetadata.has(key),
  );
  if (unexpected.length)
    throw Error(
      `Remove unsupported frontend environment variable(s): ${unexpected.sort().join(', ')}. ` +
        'Only VITE_API_URL is an application setting. Vercel public metadata is allowed. ' +
        'Keep MongoDB, Cloudinary and SMTP credentials in the backend environment. Values have not been logged.',
    );
  config ||= vercelConfiguration(env.VITE_API_URL, true);
  const headers = config.headers?.find((item) => item.source === '/(.*)')?.headers || [];
  const policy = headers.find((item) => item.key === 'Content-Security-Policy')?.value;
  const connect = policy?.match(/(?:^|;)\s*connect-src\s+([^;]+)/)?.[1].split(/\s+/);
  if (
    !policy ||
    !connect?.includes(api.origin) ||
    headers.some((item) => item.key === 'Content-Security-Policy-Report-Only')
  )
    throw Error(
      'The generated CSP does not match VITE_API_URL. Rebuild with pnpm build:production.',
    );
  if (
    /script-src[^;]*(?:'unsafe-inline'|'unsafe-eval'|\*)/.test(policy) ||
    !policy.includes("frame-ancestors 'none'")
  )
    throw Error('Production CSP cannot permit unrestricted scripts or framing.');
  const expected = vercelConfiguration(env.VITE_API_URL, true).headers[0].headers;
  if (
    expected.some(
      ({ key, value }) =>
        headers.filter((header) => header.key.toLowerCase() === key.toLowerCase()).length !== 1 ||
        !headers.some((header) => header.key === key && header.value === value),
    )
  )
    throw Error(
      'Production headers must match the generated policy. Rebuild with pnpm build:production.',
    );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Hosting variables are authoritative; no private backend file is read here.
  validateRelease({
    ...loadEnv('production', fileURLToPath(new URL('..', import.meta.url))),
    ...process.env,
  });
  console.log('Frontend release configuration validated.');
}
