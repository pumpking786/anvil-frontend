export function normalizeApiUrl(value: string) {
  const configured = import.meta.env.PROD && import.meta.env.VITE_API_URL;
  // The Vercel build routes this first-party path to the configured backend.
  // Keep cookies on the app origin, including when migrating an older saved URL.
  const url = configured ? new URL('/api', globalThis.location.origin) : new URL(value);
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Use a base URL without credentials, query parameters, or a fragment.');
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('Use HTTPS for a remote API. HTTP is allowed only on localhost.');
  return url.toString().replace(/\/$/, '');
}
