import { Buffer } from 'buffer';

const threshold = 2 * 1024 * 1024;
const partBytes = 1024 * 1024;
const maximum = 25 * 1024 * 1024;
const capabilities = new Map<string, { supported: boolean; expires: number }>();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Manifest = { id: string; size: number; parts: number; partBytes: number };
function manifest(value: Manifest): Manifest {
  if (
    !value ||
    !uuid.test(value.id) ||
    !Number.isInteger(value.size) ||
    value.size < 1 ||
    value.size > maximum ||
    value.partBytes !== partBytes ||
    value.parts !== Math.ceil(value.size / partBytes)
  )
    throw new Error('The server returned an invalid transfer. Please reconnect.');
  return value;
}
export function largeRequest(body: BodyInit | null | undefined) {
  return typeof body === 'string' && new TextEncoder().encode(body).length > threshold;
}

// Keeps every HTTP body below Vercel's limit while retaining the same route,
// authentication, role checks, revision precondition and mail idempotency key.
export async function transportFetch(base: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('X-Patra-Transport', 'parts-v1');
  const prefix = path.startsWith('/master/') ? '/master/transfers' : '/transfers';
  const piece = (route: string, options: RequestInit = {}) =>
    fetch(`${base}${route}`, {
      credentials: 'include',
      redirect: 'error',
      ...options,
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: headers.get('Authorization') || '',
        ...(headers.has('X-Patra-Workspace')
          ? { 'X-Patra-Workspace': headers.get('X-Patra-Workspace')! }
          : {}),
      },
    });
  let body = init.body;
  if (largeRequest(body)) {
    let capability = capabilities.get(base);
    if (!capability || capability.expires <= Date.now()) {
      const health = await fetch(`${base}/health`, {
        credentials: 'include',
        redirect: 'error',
        signal: init.signal || AbortSignal.timeout(15000),
      });
      if (!health.ok) return health;
      capability = {
        supported: (await health.json()).transport === 'parts-v1',
        expires: Date.now() + 60000,
      };
      capabilities.set(base, capability);
    }
    if (capability.supported) {
      const bytes = new TextEncoder().encode(body as string);
      if (bytes.length > maximum)
        throw new Error(
          'This request exceeds the 25 MB application limit. Reduce the data and try again.',
        );
      const begin = await piece(prefix, {
        method: 'POST',
        body: JSON.stringify({
          path: `/api${path}`,
          method: init.method || 'GET',
          size: bytes.length,
        }),
      });
      if (!begin.ok) return begin;
      const upload = manifest(await begin.json());
      for (let index = 0; index < upload.parts; index++) {
        init.signal?.throwIfAborted();
        const response = await piece(`${prefix}/${upload.id}/${index}`, {
          method: 'PUT',
          body: JSON.stringify({
            data: Buffer.from(bytes.subarray(index * partBytes, (index + 1) * partBytes)).toString(
              'base64',
            ),
          }),
        });
        if (!response.ok) return response;
      }
      headers.set('X-Patra-Upload', upload.id);
      body = '{}';
    }
  }
  init.signal?.throwIfAborted();
  const response = await fetch(`${base}${path}`, { ...init, headers, body });
  if (!response.ok || response.headers.get('X-Patra-Download') !== 'parts-v1') return response;
  const download = manifest((await response.json()).transfer);
  const bytes = new Uint8Array(download.size);
  for (let index = 0; index < download.parts; index++) {
    const part = await piece(`${prefix}/${download.id}/${index}`);
    if (!part.ok) return part;
    const value = await part.json();
    if (typeof value.data !== 'string' || value.data.length > Math.ceil(partBytes / 3) * 4)
      throw new Error('The downloaded data could not be verified. Please reconnect.');
    const decoded = Buffer.from(value.data, 'base64');
    if (decoded.length !== Math.min(partBytes, download.size - index * partBytes))
      throw new Error('The downloaded data is incomplete. Please reconnect.');
    bytes.set(decoded, index * partBytes);
  }
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('X-Patra-Download');
  responseHeaders.delete('Content-Length');
  return new Response(bytes, { status: response.status, headers: responseHeaders });
}
