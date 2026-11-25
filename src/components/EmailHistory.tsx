import { useEffect, useRef, useState } from 'react';
import { Mail, RefreshCw, Trash2 } from 'lucide-react';
import type { Connection } from '../domain/types';
import { EmailApi } from '../lib/email';
import { masterRequest } from '../lib/master';
import { ErrorText, Modal, Spinner } from './ui';
type Entry = {
  id: string;
  kind: string;
  status: string;
  subject: string;
  to: string[];
  cc: string[];
  bcc: string[];
  senderName?: string;
  senderEmail?: string;
  quotationNumber?: string;
  customerName?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  partial?: boolean;
  legacy?: boolean;
  provider: string;
};
export function EmailHistory({
  connection,
  owner = false,
  quotationId,
  customerId,
}: {
  connection: Connection;
  owner?: boolean;
  quotationId?: string;
  customerId?: string;
}) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false),
    [clearing, setClearing] = useState(false),
    [clearError, setClearError] = useState(''),
    [notice, setNotice] = useState('');
  const clearingRef = useRef(false);
  const active = useRef(0);
  useEffect(() => {
    const version = ++active.current;
    let loading = false;
    let disposed = false;
    async function refresh() {
      if (loading || clearingRef.current || document.visibilityState === 'hidden') return;
      loading = true;
      setBusy(true);
      setError('');
      try {
        const query = new URLSearchParams({
          offset: String(offset),
          ...(quotationId ? { quotationId } : {}),
          ...(customerId ? { customerId } : {}),
        });
        const data = owner
          ? await masterRequest('/email/history?' + query)
          : await new EmailApi(connection).history(query);
        if (!disposed && active.current === version) {
          setEntries(data.entries);
          setMore(data.hasMore);
        }
      } catch (cause) {
        if (!disposed && active.current === version) setError((cause as Error).message);
      } finally {
        loading = false;
        if (!disposed && active.current === version) setBusy(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    window.addEventListener('patra-email-sent', refresh);
    window.addEventListener('patra-email-history-cleared', refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('patra-email-sent', refresh);
      window.removeEventListener('patra-email-history-cleared', refresh);
    };
  }, [connection.url, owner, quotationId, customerId, offset, revision]);
  async function clear() {
    if (owner || clearingRef.current) return;
    clearingRef.current = true;
    active.current++;
    setClearing(true);
    setClearError('');
    try {
      const query = new URLSearchParams({
        ...(quotationId ? { quotationId } : {}),
        ...(customerId ? { customerId } : {}),
      });
      const result = await new EmailApi(connection).clearHistory(query);
      setNotice(
        `${result.cleared} completed email ${result.cleared === 1 ? 'entry cleared' : 'entries cleared'}.`,
      );
      setConfirmClear(false);
      setOffset(0);
      window.dispatchEvent(new Event('patra-email-history-cleared'));
    } catch (cause) {
      setClearError((cause as Error).message);
    } finally {
      clearingRef.current = false;
      setClearing(false);
      setRevision((value) => value + 1);
    }
  }
  return (
    <section className="panel email-history" aria-busy={busy}>
      <div className="panel-heading">
        <h2>
          <Mail size={18} />
          Email History
        </h2>
        <div className="email-history-actions">
          {!owner && (
            <button
              className="icon-button danger-button"
              type="button"
              title="Clear Email History"
              aria-label="Clear Email History"
              disabled={busy || clearing || !entries.length}
              onClick={() => {
                setClearError('');
                setConfirmClear(true);
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            className="button small"
            type="button"
            disabled={busy || clearing}
            onClick={() => setRevision((v) => v + 1)}
          >
            {busy ? <Spinner /> : <RefreshCw size={14} />}Refresh History
          </button>
        </div>
      </div>
      <div className="panel-body">
        <p className="field-hint">
          {owner ? 'Installation email activity.' : 'Your outgoing email activity.'} Sent means the
          provider accepted the message. Delivered appears only after a verified provider delivery
          event.
        </p>
        <ErrorText>{error}</ErrorText>
        {notice && (
          <p className="email-notice" role="status">
            {notice}
          </p>
        )}
        {!entries.length ? (
          <p className="email-history-empty">
            {busy
              ? 'Loading email history…'
              : error
                ? 'History is unavailable.'
                : 'No email activity recorded here yet.'}
          </p>
        ) : (
          <div className="email-history-list">
            {entries.map((entry) => (
              <article key={entry.id} className="email-history-entry">
                <div className="email-history-heading">
                  <strong>{entry.subject}</strong>
                  <span className={`email-delivery-status ${entry.status}`}>
                    {entry.status === 'uncertain'
                      ? 'Unconfirmed'
                      : entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    {entry.partial ? ' · Partial' : ''}
                  </span>
                </div>
                <p>
                  {entry.quotationNumber && <>Quotation {entry.quotationNumber} · </>}
                  {entry.customerName}
                  {entry.kind === 'test'
                    ? 'SMTP test'
                    : entry.kind === 'security'
                      ? 'Account Security'
                      : ''}
                </p>
                <dl>
                  <div>
                    <dt>To</dt>
                    <dd>{entry.to.join('; ') || 'Not recorded'}</dd>
                  </div>
                  {!!entry.cc?.length && (
                    <div>
                      <dt>CC</dt>
                      <dd>{entry.cc.join('; ')}</dd>
                    </div>
                  )}
                  {!!entry.bcc?.length && (
                    <div>
                      <dt>
                        BCC <small>(private)</small>
                      </dt>
                      <dd>{entry.bcc.join('; ')}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Sending User</dt>
                    <dd>
                      {entry.senderName} {entry.senderEmail && `<${entry.senderEmail}>`}
                    </dd>
                  </div>
                  <div>
                    <dt>Requested</dt>
                    <dd>
                      <time dateTime={entry.createdAt}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Last Status</dt>
                    <dd>
                      <time dateTime={entry.updatedAt}>
                        {new Date(entry.updatedAt).toLocaleString()}
                      </time>{' '}
                      · {entry.provider}
                    </dd>
                  </div>
                </dl>
                {entry.error && <p className="field-error">{entry.error}</p>}
                {entry.status === 'sent' && (
                  <small className="field-hint">Delivery confirmation has not been received.</small>
                )}
                {entry.legacy && (
                  <small className="field-hint">
                    Earlier version: some email details were not recorded.
                  </small>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="connection-actions">
          <button
            className="button small"
            type="button"
            disabled={!offset || busy || clearing}
            onClick={() => setOffset((v) => Math.max(0, v - 50))}
          >
            Previous
          </button>
          <button
            className="button small"
            type="button"
            disabled={!more || busy || clearing}
            onClick={() => setOffset((v) => v + 50)}
          >
            Next
          </button>
        </div>
      </div>
      {confirmClear && (
        <Modal
          title="Clear Email History"
          onClose={() => {
            if (!clearing) setConfirmClear(false);
          }}
        >
          <div className="modal-body">
            <p>
              Clear your completed email entries{' '}
              {quotationId
                ? 'for this quotation'
                : customerId
                  ? 'for this customer'
                  : 'from history'}
              ? Emails already sent will remain in recipients’ mailboxes. In-progress sends and
              duplicate-send protections are retained.
            </p>
            <ErrorText>{clearError}</ErrorText>
          </div>
          <div className="modal-actions">
            <button className="button" disabled={clearing} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
            <button className="button danger" disabled={clearing} onClick={() => void clear()}>
              {clearing ? <Spinner /> : <Trash2 size={16} />}Clear History
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function EmailHistoryDetails(props: Parameters<typeof EmailHistory>[0] & { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="panel email-history-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{props.title}</summary>
      {open && <EmailHistory {...props} />}
    </details>
  );
}
