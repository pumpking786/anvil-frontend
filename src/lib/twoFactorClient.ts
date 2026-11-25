import { authenticatedFetch, installServerSession } from './session';
import { masterRequest, installMasterSession } from './master';

// Enrollment already verified the password and is bound to that setup session.
// Confirmation accepts only the new authenticator code, unlike MFA changes.
export function confirmTwoFactorSetup(kind: 'workspace' | 'master', url: string, code: string) {
  return twoFactorRequest(kind, url, '/confirm', { code });
}

export async function twoFactorRequest(
  kind: 'workspace' | 'master',
  url: string,
  action = '',
  data?: unknown,
) {
  let result;
  if (kind === 'master') result = await masterRequest('/2fa' + action, data);
  else {
    const response = await authenticatedFetch(url, '/auth/2fa' + action, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.error || 'Could not update two-factor authentication.');
  }
  if (result.session) {
    if (kind === 'master') installMasterSession(result.session);
    else installServerSession(url, result.session);
  }
  return result;
}
