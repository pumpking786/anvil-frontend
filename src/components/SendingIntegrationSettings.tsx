import { masterRequest } from '../lib/master';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MailCheck, Save, Unplug } from 'lucide-react';
import { EmailApi, type SendingIntegration } from '../lib/email';
import type { Connection } from '../domain/types';
import { ErrorText, Field, Spinner } from './ui';
export function SendingIntegrationSettings({
  connection,
  owner = false,
}: {
  connection: Connection;
  owner?: boolean;
}) {
  const client = owner
    ? {
        integration: () => masterRequest('/email/integration'),
        saveIntegration: (value: unknown) => masterRequest('/email/integration', value, 'PUT'),
        verify: () => masterRequest('/email/verify', {}),
        disconnect: () => masterRequest('/email/integration', {}, 'DELETE'),
      }
    : new EmailApi(connection);
  const [status, setStatus] = useState<SendingIntegration>();
  const [apiKey, setApiKey] = useState('');
  const [domains, setDomains] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  function receive(value: SendingIntegration) {
    setStatus(value);
    setDomains(value.domains.join(', '));
    setApiKey('');
    setDirty(false);
  }
  useEffect(() => {
    let active = true;
    setBusy('load');
    client
      .integration()
      .then((value) => {
        if (active) receive(value);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
    };
  }, [connection.url, reload]);
  async function run(kind: 'save' | 'verify' | 'disconnect') {
    if (busy || lock.current) return;
    lock.current = true;
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      const value =
        kind === 'save'
          ? await client.saveIntegration({
              apiKey,
              domains: domains
                .split(/[,;\n]+/)
                .map((d) => d.trim().toLowerCase())
                .filter(Boolean),
            })
          : kind === 'verify'
            ? await client.verify()
            : await client.disconnect();
      receive(value);
      setNotice(
        kind === 'save'
          ? 'Connection saved. Verify your sending domains to enable email.'
          : kind === 'verify'
            ? 'Company sending domains verified. No email was sent.'
            : 'Company email delivery disconnected.',
      );
    } catch (cause) {
      setError((cause as Error).message);
      if (kind === 'verify' && status) setStatus({ ...status, verifiedAt: null });
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  return (
    <section className="panel email-settings">
      <div className="panel-heading">
        <h2>
          <MailCheck size={18} />
          Email Delivery
        </h2>
        <span className={`connection-status ${status?.verifiedAt && !dirty ? 'ok' : ''}`}>
          <i />
          {dirty
            ? 'Unsaved changes'
            : status?.verifiedAt
              ? 'Domains verified'
              : status?.configured
                ? 'Verification required'
                : 'Not connected'}
        </span>
      </div>
      <form
        className="panel-body"
        onSubmit={(event) => {
          event.preventDefault();
          void run('save');
        }}
      >
        <p className="section-description">
          Resend is used when SMTP is not configured and the user has no connected Google or
          Microsoft mailbox. Team members send from their registered email address. The company must
          authorize its exact sending domains with the provider.
        </p>
        <ol className="integration-steps">
          <li>Add your company domain in Resend and complete its DNS verification.</li>
          <li>
            Create a dedicated API key with full access so this app can check domain authorization
            and send mail.
          </li>
          <li>Save the key and approved domains below, then choose Verify domains.</li>
        </ol>
        <a
          className="text-link"
          href="https://resend.com/docs/dashboard/domains/introduction"
          target="_blank"
          rel="noreferrer"
        >
          Provider domain setup guide ↗
        </a>
        <fieldset disabled={!!busy || !status} className="email-fields">
          <Field
            label="Resend API Key"
            hint={
              status?.hasKey
                ? 'Leave blank to keep the saved key. Stored encrypted on the server.'
                : 'Only administrators can manage this key. It is never shared with users.'
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setDirty(true);
              }}
              placeholder="re_…"
            />
          </Field>
          <Field
            label="Approved Sending Domains"
            hint="Exact email domains, separated by commas. For user@anvil.com.np, authorize anvil.com.np; a different subdomain does not authorize that address."
          >
            <textarea
              required
              rows={2}
              value={domains}
              onChange={(event) => {
                setDomains(event.target.value);
                setDirty(true);
              }}
              placeholder="anvil.com.np"
            />
          </Field>
        </fieldset>
        <ErrorText>{error}</ErrorText>
        {notice && (
          <p className="email-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}
        <div className="connection-actions">
          <button className="button primary" disabled={!!busy || !dirty || !status}>
            {busy === 'save' ? <Spinner /> : <Save size={16} />}Save Delivery Connection
          </button>
          <button
            type="button"
            className="button"
            disabled={!!busy || dirty || !status?.configured}
            onClick={() => void run('verify')}
          >
            {busy === 'verify' ? <Spinner /> : <CheckCircle2 size={16} />}Verify Domains
          </button>
          {status?.configured && (
            <button
              type="button"
              className="button danger-button"
              disabled={!!busy}
              onClick={() => {
                if (confirm('Disconnect email delivery for all workspace users?'))
                  void run('disconnect');
              }}
            >
              <Unplug size={16} />
              Disconnect
            </button>
          )}
          {!status && !busy && (
            <button type="button" className="button" onClick={() => setReload((v) => v + 1)}>
              Retry
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
