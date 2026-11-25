import { authenticatedFetch } from './session';

export function ownerConnectionFailure(cause: unknown): 'failed' | 'unreachable' {
  return cause &&
    typeof cause === 'object' &&
    'status' in cause &&
    typeof cause.status === 'number' &&
    cause.status >= 400
    ? 'failed'
    : 'unreachable';
}

export type ConnectionState = 'checking' | 'connected' | 'down' | 'unreachable' | 'local';
export const connectionLabels: Record<ConnectionState, { title: string; detail: string }> = {
  checking: { title: 'Checking Connection', detail: 'Contacting your workspace' },
  connected: { title: 'API Connected', detail: 'Remote data storage' },
  down: { title: 'API Unavailable', detail: 'The service reported a problem' },
  unreachable: { title: 'API Not Reachable', detail: 'Waiting to reconnect' },
  local: { title: 'Local Workspace', detail: 'Encrypted on this device' },
};

export async function probeConnection(
  url: string,
  signal: AbortSignal,
  request = authenticatedFetch,
): Promise<ConnectionState> {
  try {
    const response = await request(url, '/workspace/status', { signal, cache: 'no-store' });
    if (!response.ok) return 'down';
    const result = await response.json().catch(() => null);
    return result?.status === 'ok' ? 'connected' : 'down';
  } catch {
    return 'unreachable';
  }
}
