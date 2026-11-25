import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MailCheck, Save } from 'lucide-react';
import type { Connection } from '../domain/types';
import { EmailApi } from '../lib/email';
import { getServerSession } from '../lib/session';
import { ErrorText, Field, Spinner } from './ui';

export function DefaultBccSettings({ connection }: { connection: Connection }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const connected = !!getServerSession(connection.url);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setBusy(true);
    setError('');
    if (!connected) {
      setBusy(false);
      return;
    }
    new EmailApi(connection)
      .policy()
      .then(({ bcc }) => {
        if (!active) return;
        setValue(bcc.join(', '));
        setSaved(bcc.join(', '));
        setLoaded(true);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [connection.url, connected, retry]);
  return (
    <section className="panel email-settings">
      <div className="panel-heading">
        <h2>
          <MailCheck size={18} />
          Default BCC Recipients
        </h2>
        <span className="tag">All outgoing email</span>
      </div>
      <form
        className="panel-body"
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current || busy || !loaded) return;
          lock.current = true;
          setBusy(true);
          setError('');
          setNotice('');
          try {
            const addresses = [
              ...new Set(
                value
                  .split(/[,;\n]+/)
                  .map((item) => item.trim().toLowerCase())
                  .filter(Boolean),
              ),
            ];
            if (
              addresses.length > 20 ||
              addresses.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
            )
              throw new Error(
                'Enter up to 20 valid email addresses, separated by commas or new lines.',
              );
            const { bcc } = await new EmailApi(connection).savePolicy(addresses);
            setValue(bcc.join(', '));
            setSaved(bcc.join(', '));
            setNotice(
              bcc.length
                ? 'Default BCC updated for all future outgoing emails.'
                : 'Default BCC removed.',
            );
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <p className="section-description">
          Automatically copy these addresses on every quotation email sent by your team. Recipients
          stay hidden from To and CC. Only administrators can change this list.
        </p>
        {!connected && (
          <p className="info-note">Sign in to your workspace server to manage email defaults.</p>
        )}
        <Field
          label="Default BCC Email Addresses"
          hint="Separate addresses with commas or new lines. Clear the field and save to remove all defaults."
        >
          <textarea
            rows={3}
            disabled={!loaded || busy}
            value={value}
            placeholder="accounts@yourcompany.com, sales-manager@yourcompany.com"
            onChange={(e) => {
              setValue(e.target.value);
              setNotice('');
            }}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        {notice && (
          <p className="email-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}
        <div className="connection-actions">
          <button className="button primary" disabled={!loaded || busy || saved === value}>
            {busy ? <Spinner /> : <Save size={16} />}Save Default BCC
          </button>
          {connected && !loaded && !busy && (
            <button type="button" className="button" onClick={() => setRetry((v) => v + 1)}>
              Retry
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
