import type { Connection } from '../domain/types';
import { authenticatedFetch, getServerSession } from './session';
export interface SendingIntegration {
  provider: 'resend';
  configured: boolean;
  hasKey: boolean;
  domains: string[];
  verifiedDomains: string[];
  verifiedAt: string | null;
}
export interface EmailStatus {
  provider: 'resend' | 'smtp' | 'google' | 'microsoft';
  configured: boolean;
  ready: boolean;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  verifiedAt: string | null;
  defaultBcc: string[];
  reason?:
    | 'mailbox_reconnect'
    | 'smtp_verify'
    | 'smtp_sender'
    | 'not_configured'
    | 'resend_verify'
    | 'resend_domain'
    | '';
}
export interface EmailReceipt {
  accepted: boolean;
  partial?: boolean;
  messageId: string;
  acceptedAt: string;
}
export class EmailApi {
  constructor(private connection: Connection) {}
  private async request<T>(path: string, data?: unknown, method = 'POST'): Promise<T> {
    if (!getServerSession(this.connection.url))
      throw new Error('Sign in to your workspace server to use email.');
    let response: Response;
    try {
      response = await authenticatedFetch(this.connection.url, `/email${path}`, {
        method: data === undefined ? 'GET' : method,
        headers: {
          'X-Patra-Workspace': this.connection.workspaceId || 'primary',
          ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
        redirect: 'error',
        signal: AbortSignal.timeout(path === '/send' ? 180000 : 60000),
      });
    } catch {
      throw new Error(
        path === '/send' || path === '/test-send'
          ? 'The send result could not be confirmed. Check your mail provider before starting another message. Retry here uses the same request ID.'
          : 'Could not reach the email API. Check the base URL and server.',
      );
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'The API credential was rejected. Ask your administrator to reconnect.'
          : response.status === 404 && path.startsWith('/connections')
            ? 'The backend is running an older version. Restart it to load SMTP and OAuth settings, then choose Retry connection.'
            : body.error || 'This backend does not support the email integration.',
      );
    return body as T;
  }
  history(query: URLSearchParams) {
    return this.request<{ entries: any[]; hasMore: boolean }>('/history?' + query);
  }
  clearHistory(query: URLSearchParams) {
    return this.request<{ cleared: number }>('/history?' + query, { confirm: true }, 'DELETE');
  }
  status() {
    return this.request<EmailStatus>('');
  }
  integration() {
    return this.request<SendingIntegration>('/integration');
  }
  saveIntegration(value: { apiKey: string; domains: string[] }) {
    return this.request<SendingIntegration>('/integration', value, 'PUT');
  }
  disconnect() {
    return this.request<SendingIntegration>('/integration', {}, 'DELETE');
  }
  policy() {
    return this.request<{ bcc: string[] }>('/default-bcc');
  }
  savePolicy(bcc: string[]) {
    return this.request<{ bcc: string[] }>('/default-bcc', { bcc }, 'PUT');
  }
  verify() {
    return this.request<SendingIntegration>('/verify', {});
  }
  testSend() {
    return this.request<{
      accepted: boolean;
      to: string;
      provider: string;
      messageId: string;
      acceptedAt: string;
    }>('/test-send', {});
  }
  connections() {
    return this.request<MailConnections>('/connections');
  }
  saveConnection(kind: MailConnectionKind, value: unknown) {
    return this.request<MailConnections>('/connections/' + kind, value, 'PUT');
  }
  removeConnection(kind: MailConnectionKind) {
    return this.request<MailConnections>('/connections/' + kind, {}, 'DELETE');
  }
  verifySmtp() {
    return this.request<MailConnections>('/connections/smtp/verify', {});
  }
  mailbox() {
    return this.request<MailboxStatus>('/account');
  }
  disconnectMailbox() {
    return this.request<MailboxStatus>('/account', {}, 'DELETE');
  }
  connectMailbox(provider: 'google' | 'microsoft') {
    return this.request<{ url: string }>('/oauth/start/' + provider, {});
  }
  send(payload: {
    idempotencyKey: string;
    quotationId: string;
    quotationNumber: string;
    customerId?: string;
    customerName?: string;
    to: string | string[];
    cc?: string[];
    bcc?: string[];
    signature?: string;
    logo?: string;
    color?: string;
    align?: string;
    font?: string;
    subject: string;
    message: string;
    filename: string;
    pdf: string;
  }) {
    return this.request<EmailReceipt>('/send', payload);
  }
}
export function blobBase64(blob: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Preparation cancelled.', 'AbortError'));
    const reader = new FileReader();
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reader.onload = reader.onerror = reader.onabort = null;
    };
    const fail = (error: Error) => {
      cleanup();
      reader.abort();
      reject(error);
    };
    const cancel = () => fail(new DOMException('Preparation cancelled.', 'AbortError'));
    const timer = setTimeout(
      () =>
        fail(new Error('Could not prepare the PDF attachment. No email was sent. Please retry.')),
      15000,
    );
    signal?.addEventListener('abort', cancel, { once: true });
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
      cleanup();
      if (value) resolve(value);
      else reject(new Error('The PDF attachment is empty. No email was sent.'));
    };
    reader.onerror = () => fail(new Error('Could not read the quotation PDF. No email was sent.'));
    reader.onabort = cancel;
    try {
      reader.readAsDataURL(blob);
    } catch {
      fail(new Error('Could not read the quotation PDF. No email was sent.'));
    }
  });
}

export type MailConnectionKind = 'smtp' | 'google' | 'microsoft';
export interface MailConnections {
  configured: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  approvedHost: string;
  approvedPort: number;
  migrationRequired: boolean;
  smtp: {
    host: string;
    port: number;
    hasUsername: boolean;
    fromEmail: string;
    fromName: string;
    hasPassword: boolean;
    verifiedAt: string | null;
  } | null;
  google: { clientId: string; callback: string; hasSecret: boolean } | null;
  microsoft: { clientId: string; callback: string; hasSecret: boolean } | null;
}
export interface MailboxStatus {
  google: boolean;
  microsoft: boolean;
  connected: {
    provider: 'google' | 'microsoft';
    email: string;
    connectedAt: string;
    ready: boolean;
  } | null;
}
