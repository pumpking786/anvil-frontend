import {
  persistentRequest,
  rememberSignedOut,
  restoreSuppressed,
  isSessionRejected,
} from './persistentSession';
import { TwoFactorRequired } from './twoFactor';
import { normalizeApiUrl } from './apiUrl';
import { largeRequest, transportFetch } from './transport';
import type { Company } from '../domain/types';
export interface MasterSession {
  accessToken: string;
  expiresAt: number;
  persistentExpiresAt?: number;
  email: string;
  mustChangePassword: boolean;
  mustSetupTwoFactor?: boolean;
  twoFactorRequired?: boolean;
}
export interface MasterConfiguration {
  remoteEnabled: boolean;
  configured: boolean;
  revision: number;
  needsAdministrator: boolean;
  company: Pick<Company, 'name' | 'address' | 'phone' | 'email' | 'pan'> | null;
  quotePrefix: string;
  storage?: { database: 'MongoDB' | 'SQLite'; images: 'Cloudinary' | 'Server storage' };
}
let session: MasterSession | undefined;
let apiUrl = '';
let generation = 0;
const restoring = new Map<string, Promise<MasterSession | undefined>>();
export async function resumeMasterSession(
  url: string,
  force = false,
): Promise<MasterSession | undefined> {
  url = normalizeApiUrl(url);
  if (!force) {
    const stored = restoreMasterSession();
    if (stored && apiUrl === url) return stored;
  }
  if (restoreSuppressed('master')) return undefined;
  const key = `${generation}:${url}`;
  if (restoring.has(key)) return restoring.get(key);
  const version = generation;
  const pending = (async () => {
    try {
      const value = (await persistentRequest(url, 'master')) as MasterSession;
      if (version !== generation || restoreSuppressed('master')) return undefined;
      return install(url, value);
    } catch (error) {
      if ((error as { status?: number }).status === 401) return undefined;
      throw error;
    } finally {
      restoring.delete(key);
    }
  })();
  restoring.set(key, pending);
  return pending;
}
export async function configureMasterPersistence(remember: boolean) {
  if (!session) throw new Error('Complete owner sign-in first.');
  const current = session;
  const version = generation;
  const result = await persistentRequest(apiUrl, 'master', current.accessToken, remember);
  if (version !== generation || session?.accessToken !== current.accessToken)
    throw new Error('This sign-in has ended. Please sign in again.');
  rememberSignedOut('master', false);
  return install(apiUrl, { ...current, persistentExpiresAt: result.persistentExpiresAt });
}
function scheduleSession(value: MasterSession) {
  clearTimeout(expiration);
  const saved = !!value.persistentExpiresAt;
  const until = Math.min(value.expiresAt, value.persistentExpiresAt || Infinity);
  const canRenew = saved && value.persistentExpiresAt! > value.expiresAt;
  expiration = setTimeout(
    async () => {
      if (session?.accessToken !== value.accessToken) return;
      if (!saved || value.persistentExpiresAt! <= Date.now()) {
        expire();
        return;
      }
      try {
        const next = await resumeMasterSession(apiUrl, true);
        if (!next && session?.accessToken === value.accessToken) expire();
      } catch (error) {
        if (session?.accessToken !== value.accessToken) return;
        if (isSessionRejected(error)) expire();
        else expiration = setTimeout(() => scheduleSession(value), 15000);
      }
    },
    Math.max(1000, until - Date.now() - (canRenew ? 60000 : 0)),
  );
}
let expiration: ReturnType<typeof setTimeout> | undefined;
function install(url: string, value: MasterSession) {
  apiUrl = normalizeApiUrl(url);
  session = value;
  try {
    sessionStorage.setItem('patra-owner-session', JSON.stringify({ url: apiUrl, value }));
  } catch {}
  scheduleSession(value);
  return value;
}
export function restoreMasterSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem('patra-owner-session') || 'null');
    if (stored?.value?.accessToken && stored.value.expiresAt > Date.now())
      return install(stored.url, stored.value);
  } catch {}
  return undefined;
}
function expire() {
  clearTimeout(expiration);
  session = undefined;
  try {
    sessionStorage.removeItem('patra-owner-session');
  } catch {}
  window.dispatchEvent(new Event('patra-master-expired'));
}
async function request(
  url: string,
  path: string,
  data?: unknown,
  method?: string,
  revision?: number,
) {
  const requestToken = session?.accessToken;
  const requestBody = data === undefined ? undefined : JSON.stringify(data);
  let response: Response;
  try {
    response = await transportFetch(normalizeApiUrl(url), `/master${path}`, {
      method: method || (data === undefined ? 'GET' : 'POST'),
      credentials: 'include',
      redirect: 'error',
      signal: AbortSignal.timeout(
        largeRequest(requestBody)
          ? 180000
          : path === '/smtp/verify' ||
              path.startsWith('/connections') ||
              path === '/2fa/reset/request' ||
              path === '/email/test-send'
            ? 60000
            : method === 'PUT' && ['/database', '/cloudinary'].includes(path)
              ? 120000
              : 30000,
      ),
      headers: {
        'Content-Type': 'application/json',
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
        ...(revision === undefined ? {} : { 'If-Match': `"${revision}"` }),
      },
      body: requestBody,
    });
  } catch {
    throw new Error(
      'Cannot reach the installation-owner service. Check the API address and confirm the app server is running.',
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      requestToken &&
      session?.accessToken === requestToken &&
      path !== '/login' &&
      path !== '/2fa/verify'
    )
      expire();
    throw Object.assign(
      new Error(result.error || 'The installation-owner service could not complete this request.'),
      { status: response.status },
    );
  }
  return result;
}
export async function masterSignIn(url: string, email: string, password: string) {
  generation++;
  const result = await request(url, '/login', { email, password });
  if (result.requiresTwoFactor) throw new TwoFactorRequired(result);
  return install(url, result);
}
export function installMasterSession(value: MasterSession) {
  return install(apiUrl, value);
}
export async function verifyMasterTwoFactor(
  url: string,
  challengeToken: string,
  code: string,
  recovery = false,
  rememberDevice = false,
) {
  return install(
    url,
    await request(url, '/2fa/verify', { challengeToken, code, recovery, rememberDevice }),
  );
}
export async function masterRequest(
  path: string,
  data?: unknown,
  method?: string,
  revision?: number,
) {
  if ((!session || session.expiresAt <= Date.now()) && apiUrl)
    await resumeMasterSession(apiUrl, true);
  if (!session || session.expiresAt <= Date.now()) {
    expire();
    throw new Error('Sign in with the installation-owner account before configuring a workspace.');
  }
  return request(apiUrl, path, data, method, revision);
}
export async function changeMasterPassword(currentPassword: string, password: string) {
  return install(apiUrl, await masterRequest('/password', { currentPassword, password }));
}
export function masterSignOut() {
  generation++;
  rememberSignedOut('master', true);
  if (session)
    void fetch(`${apiUrl}/master/logout`, {
      method: 'POST',
      credentials: 'include',
      redirect: 'error',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  clearTimeout(expiration);
  session = undefined;
  try {
    sessionStorage.removeItem('patra-owner-session');
  } catch {}
}
