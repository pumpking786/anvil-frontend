import { useEffect, useRef, useState } from 'react';
import { Mail, Save, CheckCircle2, Unplug } from 'lucide-react';
import { EmailApi, type MailConnections, type MailboxStatus } from '../lib/email';
import { masterRequest } from '../lib/master';
import type { Connection } from '../domain/types';
import { Field, ErrorText, Spinner } from './ui';
type OAuthKind = 'google' | 'microsoft';
const names = { google: 'Google OAuth', microsoft: 'Microsoft OAuth' };
export function MailConnectionSettings({ connection }: { connection: Connection }) {
  const api = {
    connections: () => masterRequest('/email/connections'),
    removeConnection: (kind: OAuthKind) =>
      masterRequest('/email/connections/' + kind, {}, 'DELETE'),
    saveConnection: (kind: OAuthKind, value: unknown) =>
      masterRequest('/email/connections/' + kind, value, 'PUT'),
  };
  const [data, setData] = useState<MailConnections>();
  const [kind, setKind] = useState<OAuthKind>('google');
  const [reload, setReload] = useState(0);
  const [fields, setFields] = useState({
    clientId: '',
    clientSecret: '',
    callback: '',
  });
  const [busy, setBusy] = useState('load'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [dirty, setDirty] = useState(false);
  const lock = useRef(false);
  function receive(value: MailConnections, selected = kind) {
    setData(value);
    const c = value[selected];
    setFields({
      clientId: c?.clientId || '',
      clientSecret: '',
      callback:
        c?.callback || `${connection.url.replace(/\/$/, '')}/email/oauth/callback/${selected}`,
    });
    setDirty(false);
    return c;
  }
  useEffect(() => {
    let active = true;
    setBusy('load');
    setError('');
    setData(undefined);
    api
      .connections()
      .then((v) => {
        if (active) {
          if (dirty) setData(v);
          else receive(v);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
    };
  }, [connection.url, reload]);
  function field(key: keyof typeof fields, value: string) {
    setFields((v) => ({ ...v, [key]: value }));
    setDirty(true);
    setNotice('');
  }
  async function run(action: 'save' | 'remove') {
    if (lock.current || busy || !data) return;
    lock.current = true;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      const value =
        action === 'remove'
          ? await api.removeConnection(kind)
          : await api.saveConnection(kind, {
              clientId: fields.clientId,
              clientSecret: fields.clientSecret,
              callback: fields.callback,
            });
      receive(value);
      setNotice(
        action === 'remove'
          ? 'OAuth app removed.'
          : 'OAuth app saved. Users can connect their mailbox in Settings.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
      lock.current = false;
    }
  }
  return (
    <section className="panel email-settings">
      <div className="panel-heading">
        <h2>
          <Mail size={18} />
          OAuth Application Configuration
        </h2>
        <span className={`connection-status ${data?.[kind] && !dirty ? 'ok' : ''}`}>
          <i />
          {busy === 'load'
            ? 'Loading settings…'
            : !data
              ? 'Connection unavailable'
              : dirty
                ? 'Unsaved changes'
                : data?.[kind]
                  ? 'App configured'
                  : 'Not configured'}
        </span>
      </div>
      <form
        className="panel-body"
        onSubmit={(e) => {
          e.preventDefault();
          void run('save');
        }}
      >
        {
          <Field label="Connection Type">
            <select
              disabled={!!busy}
              value={kind}
              onChange={(e) => {
                const next = e.target.value as OAuthKind;
                if (dirty && !confirm('Discard unsaved connection changes?')) return;
                setKind(next);
                if (data) receive(data, next);
                if (data) setError('');
                else
                  setFields((v) => ({
                    ...v,
                    callback: `${connection.url.replace(/\/$/, '')}/email/oauth/callback/${next}`,
                  }));
                setNotice('');
              }}
            >
              {Object.entries(names).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        }
        <p className="section-description">
          Optional Google and Microsoft authorization lets users send through their own mailbox.
          SMTP is configured exclusively in the backend environment.
        </p>
        <fieldset className="email-fields" disabled={!!busy}>
          <p className="field-hint">
            Register a Web application in{' '}
            {kind === 'google' ? 'Google Cloud (enable Gmail API)' : 'Microsoft Entra'}. Add the
            exact callback URL below.{' '}
            {kind === 'google'
              ? 'Request email identity and gmail.send permissions; add test users while the consent app is in testing.'
              : 'Use delegated User.Read and Mail.Send permissions, with offline access. Choose supported account types for your organization.'}
          </p>
          <Field label="Application / Client ID">
            <input
              required
              value={fields.clientId}
              onChange={(e) => field('clientId', e.target.value)}
            />
          </Field>
          <Field
            label="Client Secret"
            hint={
              data?.[kind]
                ? 'Leave blank to retain the saved secret for the same client ID.'
                : 'Only administrators can save this; users never receive it.'
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              value={fields.clientSecret}
              onChange={(e) => field('clientSecret', e.target.value)}
            />
          </Field>
          <Field
            label="Backend Callback URL"
            hint="Register this exact URL as a Web redirect URI. Use HTTPS in production. Saving changes requires users to reconnect."
          >
            <input
              required
              type="url"
              value={fields.callback}
              onChange={(e) => field('callback', e.target.value)}
            />
          </Field>
          <a
            className="text-link"
            target="_blank"
            rel="noreferrer"
            href={
              kind === 'google'
                ? 'https://developers.google.com/identity/protocols/oauth2/web-server'
                : 'https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app'
            }
          >
            Provider setup guide ↗
          </a>
        </fieldset>
        <ErrorText>{error}</ErrorText>
        {!data && !busy && (
          <div className="email-notice" role="status">
            <span>
              Connection settings could not be loaded. You can fill in the form, then retry the
              connection before saving.
            </span>
            <button type="button" className="button" onClick={() => setReload((v) => v + 1)}>
              Retry Connection
            </button>
          </div>
        )}

        {notice && (
          <p className="email-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}
        <div className="connection-actions">
          <button className="button primary" disabled={!!busy || !dirty || !data}>
            {busy === 'save' ? <Spinner /> : <Save size={16} />}Save {names[kind]}
          </button>
          {data?.[kind] && (
            <button
              type="button"
              className="button danger-button"
              disabled={!!busy}
              onClick={() => {
                if (
                  confirm(
                    `Remove ${names[kind]}? Connected users will need to reconnect after this provider is configured again.`,
                  )
                )
                  void run('remove');
              }}
            >
              <Unplug size={16} />
              Remove
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
export function MailboxConnection({ apiUrl, email }: { apiUrl: string; email: string }) {
  const [status, setStatus] = useState<MailboxStatus>(),
    [busy, setBusy] = useState('load'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const popup = useRef<Window | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    lock = useRef(false);
  const connection: Connection = { mode: 'remote', url: apiUrl, token: '' };
  async function refresh() {
    const s = await new EmailApi(connection).mailbox();
    setStatus(s);
    return s;
  }
  useEffect(() => {
    let active = true;
    new EmailApi(connection)
      .mailbox()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
      clearInterval(timer.current);
    };
  }, [apiUrl]);
  async function connect(provider: 'google' | 'microsoft') {
    if (lock.current) return;
    lock.current = true;
    setBusy(provider);
    setError('');
    setNotice('');
    popup.current = window.open('about:blank', 'patra-mail-connect', 'width=620,height=760');
    if (!popup.current) {
      setError('Allow popups for this app to connect your mailbox.');
      setBusy('');
      lock.current = false;
      return;
    }
    try {
      const { url } = await new EmailApi(connection).connectMailbox(provider);
      popup.current.location.href = url;
      const previous = status?.connected?.connectedAt,
        until = Date.now() + 600000;
      let polling = false;
      timer.current = setInterval(async () => {
        if (polling) return;
        polling = true;
        try {
          const s = await refresh();
          if (s.connected?.ready && s.connected.connectedAt !== previous) {
            setNotice('Mailbox connected. Outgoing quotation emails will use ' + s.connected.email);
            clearInterval(timer.current);
            setBusy('');
            lock.current = false;
            popup.current?.close();
          } else if (popup.current?.closed || Date.now() > until) {
            clearInterval(timer.current);
            setBusy('');
            lock.current = false;
            setNotice('Connection window closed. Check the connection status or try again.');
          }
        } catch (e) {
          setError((e as Error).message);
          clearInterval(timer.current);
          setBusy('');
          lock.current = false;
        } finally {
          polling = false;
        }
      }, 2000);
    } catch (e) {
      popup.current?.close();
      setError((e as Error).message);
      setBusy('');
      lock.current = false;
    }
  }
  return (
    <section className="panel email-settings">
      <div className="panel-heading">
        <h2>
          <Mail size={18} />
          Sending Mailbox
        </h2>
        <span className={`connection-status ${status?.connected?.ready ? 'ok' : ''}`}>
          <i />
          {status?.connected?.ready
            ? 'Connected'
            : status?.connected
              ? 'Reconnect required'
              : 'Company delivery'}
        </span>
      </div>
      <div className="panel-body">
        <p className="section-description">
          Authorize Google or Microsoft to send quotations from <strong>{email}</strong>. Select the
          same address in the provider’s sign-in window. Your password stays with the provider.
        </p>
        {status?.connected && (
          <p>
            {names[status.connected.provider]} · {status.connected.email}
          </p>
        )}
        <div className="connection-actions">
          {(['google', 'microsoft'] as const).map((p) => (
            <button
              key={p}
              className="button"
              disabled={!!busy || !status?.[p]}
              onClick={() => void connect(p)}
            >
              {busy === p ? <Spinner /> : <Mail size={16} />}Connect{' '}
              {p === 'google' ? 'Google' : 'Microsoft'}
            </button>
          ))}
          {status?.connected && (
            <button
              className="button danger-button"
              disabled={!!busy}
              onClick={async () => {
                if (
                  !confirm(
                    'Disconnect this mailbox? Future emails will use the company delivery connection, if configured.',
                  )
                )
                  return;
                setBusy('remove');
                setError('');
                try {
                  setStatus(await new EmailApi(connection).disconnectMailbox());
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy('');
                }
              }}
            >
              <Unplug size={16} />
              Disconnect
            </button>
          )}
        </div>
        {!status?.google && !status?.microsoft && status && (
          <p className="field-hint">
            The installation owner must configure the Google or Microsoft app in the Owner Portal
            first. SMTP uses the backend environment settings.
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        {notice && (
          <p role="status" className="email-notice">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
