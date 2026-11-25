import type { Connection, Workspace } from '../domain/types';
import { workspaceSchema } from '../domain/schema';
import { authenticatedFetch, getServerSession } from './session';
import { workspaceRevision } from './workspaceRevision';
export { normalizeApiUrl } from './apiUrl';
export class CompanyAccessError extends Error {}
export class WorkspaceApi {
  private revision: string | null = null;
  private mutationVersion = 0;
  private loadVersion = 0;
  constructor(private connection: Connection) {}
  async companies(): Promise<import('../domain/types').CompanyWorkspace[]> {
    const response = await authenticatedFetch(this.connection.url, '/workspaces', {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Could not load your company access. Please try again.');
    return (await response.json()).companies;
  }
  private preferenceKey() {
    return `patra-company:${this.connection.url}:${getServerSession(this.connection.url)?.user.id || ''}`;
  }
  rememberCompany() {
    try {
      localStorage.setItem(this.preferenceKey(), this.connection.workspaceId || 'primary');
    } catch {
      /* Optional preference. */
    }
  }
  private async prepare() {
    if (this.connection.workspaceId) return;
    const available = await this.companies();
    let saved = '';
    try {
      saved = localStorage.getItem(this.preferenceKey()) || '';
    } catch {
      /* Optional preference. */
    }
    this.connection.workspaceId =
      available.find((c) => c.id === saved)?.id || available[0]?.id || 'primary';
  }
  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('X-Patra-Workspace', this.connection.workspaceId || 'primary');
    const result = await authenticatedFetch(this.connection.url, path, {
      ...init,
      headers: Object.fromEntries(headers),
    });
    if (!result.ok) {
      if (result.status === 403) {
        const detail = await result.json().catch(() => ({}));
        if (detail.error?.includes('company access')) throw new CompanyAccessError(detail.error);
        throw new Error(detail.error || 'Your role does not allow this action.');
      }
      if (result.status === 401)
        throw new Error('Your server session ended or your role does not allow this action.');
      if (result.status === 409 || result.status === 412)
        throw new Error(
          'The remote workspace changed. Reload it before saving; your local edits have not been sent.',
        );
      const detail = await result.json().catch(() => ({}));
      throw new Error(
        typeof detail.error === 'string'
          ? detail.error.slice(0, 240)
          : `The API returned ${result.status}. No changes were saved.`,
      );
    }
    return result;
  }
  async load(accept = () => true): Promise<Workspace | null> {
    if (!this.connection.workspaceId) await this.prepare();
    const mutation = this.mutationVersion;
    const request = ++this.loadVersion;
    const response = await this.request('/workspace');
    const body = await response.json();
    const parsed = body?.workspace === null ? null : workspaceSchema.safeParse(body?.workspace);
    if (parsed && !parsed.success)
      throw new Error('The API returned invalid workspace data. Check the backend contract.');
    const workspace = parsed?.success ? parsed.data : null;
    const tag = workspaceRevision(response.headers);
    if (!accept() || mutation !== this.mutationVersion || request !== this.loadVersion) return null;
    this.revision = tag;
    return workspace;
  }
  async watch(
    onChange: () => void,
    signal: AbortSignal,
    onAccessRevoked?: (message: string) => void,
  ) {
    let lastEvent = '';
    while (!signal.aborted) {
      try {
        const response = await this.request('/workspace/events', { signal });
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (!signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let end;
            while ((end = buffer.indexOf('\n\n')) !== -1) {
              const event = buffer.slice(0, end);
              buffer = buffer.slice(end + 2);
              if (event.startsWith('data:') && event !== lastEvent) {
                lastEvent = event;
                onChange();
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        if (error instanceof CompanyAccessError) {
          onAccessRevoked?.(error.message);
          onChange();
          return;
        }
        /* Retry transient disconnections. Authentication expiry is handled globally. */
      }
      if (!signal.aborted)
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', done);
            resolve();
          };
          const timer = setTimeout(done, 2000);
          signal.addEventListener('abort', done, { once: true });
        });
    }
  }
  async accountLocks(): Promise<Record<string, import('../domain/types').AccountAccess>> {
    const result = await (await this.request('/users/locks')).json();
    return (
      result.access ||
      Object.fromEntries(
        Object.entries(result.locks || {}).map(([id, until]) => [
          id,
          { lockedUntil: Number(until), manual: false, ownerLocked: false },
        ]),
      )
    );
  }
  async manageUsers(
    action: import('../domain/types').UserAction,
  ): Promise<{ workspace: Workspace; temporaryPassword?: string }> {
    // Refresh the revision before an access action; never retry a password reset after sending it.
    const beforeReset = action.type === 'reset' ? await this.load() : undefined;
    if (action.type === 'reset' && !beforeReset)
      throw new Error('Reload the workspace before resetting this password.');
    if (!this.revision) throw new Error('Reconnect to the workspace before managing users.');
    this.mutationVersion++;
    const response = await this.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'If-Match': this.revision },
      body: JSON.stringify(action),
    });
    const result = await response.json();
    const workspace = workspaceSchema.parse(result.workspace || beforeReset);
    this.revision = workspaceRevision(response.headers);
    return { workspace, temporaryPassword: result.temporaryPassword };
  }
  async save(workspace: Workspace): Promise<Workspace> {
    if (!this.revision) throw new Error('Connect to the remote workspace before saving.');
    this.mutationVersion++;
    const result = await this.request('/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': this.revision },
      body: JSON.stringify({ workspace }),
    });
    this.revision = workspaceRevision(result.headers);
    return workspaceSchema.parse((await result.json()).workspace || workspace);
  }
}
