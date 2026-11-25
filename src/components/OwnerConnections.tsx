import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, Database, Mail, RefreshCw, PlugZap, Send, Server } from 'lucide-react';
import type { Connection } from '../domain/types';
import { masterRequest } from '../lib/master';
import { ownerConnectionFailure } from '../lib/connectionHealth';
import { syncInstallationBrand } from '../lib/installationBrand';
import { ErrorText, Spinner } from './ui';
import { MailConnectionSettings } from './MailConnections';
type Service = 'api' | 'smtp' | 'mongodb' | 'cloudinary';
type Health = {
  service: Service;
  configured: boolean;
  status: 'connected' | 'disconnected' | 'failed';
  message: string;
  checkedAt: number;
  lastSuccessfulTestAt: number | null;
};
const services = [
  { id: 'api', name: 'Backend API', icon: Server },
  { id: 'smtp', name: 'SMTP email', icon: Mail },
  { id: 'mongodb', name: 'MongoDB database', icon: Database },
  { id: 'cloudinary', name: 'Cloudinary Storage', icon: Cloud },
] as const;
export function OwnerConnections({ connection }: { connection: Connection }) {
  const [health, setHealth] = useState<Partial<Record<Service, Health>>>({});
  const [busy, setBusy] = useState<Partial<Record<Service, string>>>({});
  const [failure, setFailure] = useState<'failed' | 'unreachable' | null>(null);
  const [notices, setNotices] = useState<Partial<Record<Service, string>>>({});
  const [syncingData, setSyncingData] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [syncError, setSyncError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false),
    [emailResult, setEmailResult] = useState(''),
    [emailError, setEmailError] = useState('');
  const pending = useRef(new Set<string>()),
    generation = useRef(0),
    active = useRef(true),
    lastCheck = useRef(0),
    testId = useRef<string | undefined>(undefined);
  const allRequest = useRef<Promise<unknown> | null>(null);
  const load = useCallback(async () => {
    if (pending.current.size || document.visibilityState === 'hidden') return;
    pending.current.add('all');
    const version = generation.current;
    setBusy({ api: 'Syncing', smtp: 'Syncing', mongodb: 'Syncing', cloudinary: 'Syncing' });
    try {
      allRequest.current = masterRequest('/connections');
      const value = (await allRequest.current) as Partial<Record<Service, Health>>;
      if (active.current && generation.current === version) {
        setHealth(value);
        setFailure(null);
        lastCheck.current = Date.now();
      }
    } catch (cause) {
      if (active.current) {
        setFailure(ownerConnectionFailure(cause));
        setNotices({});
      }
    } finally {
      pending.current.delete('all');
      allRequest.current = null;
      if (active.current) setBusy({});
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void load();
    const timer = setInterval(() => void load(), 60000);
    const focus = () => {
      if (Date.now() - lastCheck.current > 30000) void load();
    };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      active.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [load]);
  async function probe(id: Service, action: 'test' | 'sync') {
    if (allRequest.current) {
      await allRequest.current.catch(() => {});
      await Promise.resolve();
    }
    if (!active.current || pending.current.has(id)) return;
    pending.current.add(id);
    generation.current++;
    setBusy((v) => ({ ...v, [id]: action === 'test' ? 'Testing' : 'Syncing' }));
    setNotices((v) => ({ ...v, [id]: '' }));
    try {
      const value = await masterRequest(`/connections/${id}/${action}`, {});
      if (active.current) {
        setHealth((v) => ({ ...v, [id]: value }));
        setFailure(null);
        setNotices((v) => ({ ...v, [id]: value.message }));
      }
    } catch (cause) {
      if (active.current) {
        setFailure(ownerConnectionFailure(cause));
        setNotices({ [id]: (cause as Error).message });
      }
    } finally {
      pending.current.delete(id);
      if (active.current) setBusy((v) => ({ ...v, [id]: '' }));
    }
  }
  async function sendTest() {
    if (pending.current.has('email')) return;
    pending.current.add('email');
    setEmailBusy(true);
    setEmailResult('');
    setEmailError('');
    testId.current ||= crypto.randomUUID();
    try {
      const result = await masterRequest('/email/test-send', { idempotencyKey: testId.current });
      setEmailResult(
        `Test email sent to ${result.to}. Accepted by SMTP at ${new Date(result.acceptedAt).toLocaleString()}. Check the inbox or spam folder to confirm receipt.`,
      );
      testId.current = undefined;
      window.dispatchEvent(new Event('patra-email-sent'));
    } catch (error) {
      setEmailError((error as Error).message);
    } finally {
      pending.current.delete('email');
      setEmailBusy(false);
      await probe('smtp', 'sync');
    }
  }
  async function syncData() {
    if (pending.current.size) return;
    pending.current.add('data');
    setSyncingData(true);
    setSyncResult('');
    setSyncError('');
    try {
      const result = await masterRequest('/sync', {});
      const counts = result.counts;
      setSyncResult(
        `Synced at ${new Date(result.syncedAt).toLocaleString()}: ${counts.users} users, ${counts.customers} customers, ${counts.products} products and ${counts.quotations} quotations. ${result.changedRecords} image records updated. Data: ${result.storage.database}; accounts: ${result.storage.accounts}; images: ${result.images}.`,
      );
      void syncInstallationBrand();
    } catch (error) {
      setSyncError((error as Error).message);
    } finally {
      pending.current.delete('data');
      setSyncingData(false);
      await load();
    }
  }
  return (
    <section className="owner-connections">
      <div className="owner-connections-heading">
        <div>
          <span className="eyebrow">OWNER CONTROLS</span>
          <h2>Connections & Delivery</h2>
          <p>Live checks of the services currently used by this backend.</p>
        </div>
      </div>
      <div className="panel owner-test-email">
        <div>
          <h3>Data & Image Synchronization</h3>
          <p>
            Refresh saved records and upload pending logos, photos, letterheads and signature images
            to the configured storage.
          </p>
        </div>
        <button
          type="button"
          className="button small"
          disabled={syncingData || emailBusy || Object.values(busy).some(Boolean)}
          onClick={() => void syncData()}
        >
          {syncingData ? <Spinner /> : <RefreshCw size={15} />}Sync Data & Images
        </button>
        {syncResult && (
          <p role="status" className="email-notice">
            {syncResult}
          </p>
        )}
        <ErrorText>{syncError}</ErrorText>
      </div>
      {failure && (
        <p className="info-note" role="alert">
          {failure === 'unreachable'
            ? 'Backend unreachable. Reconnect to refresh.'
            : 'The backend returned an error. Retry the connection check.'}{' '}
          Previous results may be outdated.
        </p>
      )}
      <div className="owner-connection-grid">
        {services.map(({ id, name, icon: Icon }) => {
          const value = health[id];
          const state =
            busy[id] ||
            (failure
              ? id === 'api' && failure === 'failed'
                ? 'Failed'
                : 'Disconnected'
              : value?.status === 'connected'
                ? 'Connected'
                : value?.status === 'failed'
                  ? 'Failed'
                  : 'Disconnected');
          return (
            <article className="panel owner-connection-card" key={id} aria-busy={!!busy[id]}>
              <div className="owner-connection-title">
                <Icon size={21} />
                <h3>{name}</h3>
                <span className={`service-status ${state.toLowerCase()}`} role="status">
                  <i />
                  {state}
                </span>
              </div>
              <p>
                {failure
                  ? id === 'api'
                    ? failure === 'unreachable'
                      ? 'The API cannot be reached. Check your network and backend.'
                      : 'The API responded with an error. Check the backend and retry.'
                    : 'The latest service status could not be checked. Previous results may be outdated.'
                  : value?.message ||
                    (id === 'api' && health.smtp
                      ? 'Restart the backend to enable API connection checks.'
                      : 'Waiting for a live backend connection check.')}
              </p>
              <dl className="connection-timestamps">
                <div>
                  <dt>Last Successful Test</dt>
                  <dd>
                    {value?.lastSuccessfulTestAt ? (
                      <time dateTime={new Date(value.lastSuccessfulTestAt).toISOString()}>
                        {new Date(value.lastSuccessfulTestAt).toLocaleString()}
                      </time>
                    ) : (
                      'No successful test recorded'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Last Checked</dt>
                  <dd>
                    {value?.checkedAt
                      ? new Date(value.checkedAt).toLocaleString()
                      : 'Not checked yet'}
                  </dd>
                </div>
              </dl>
              <div className="connection-actions">
                <button
                  className="button small primary"
                  disabled={!!busy[id] || emailBusy || syncingData}
                  onClick={() => void probe(id, 'test')}
                >
                  {busy[id] === 'Testing' ? <Spinner /> : <PlugZap size={15} />}Test Connection
                </button>
                <button
                  className="button small"
                  disabled={!!busy[id] || emailBusy || syncingData}
                  onClick={() => void probe(id, 'sync')}
                >
                  {busy[id] === 'Syncing' ? <Spinner /> : <RefreshCw size={15} />}Sync Status
                </button>
              </div>
              {notices[id] && (
                <p
                  className={`connection-result ${state === 'Connected' ? 'success' : ''}`}
                  role="status"
                >
                  {notices[id]}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <div className="panel owner-test-email">
        <div>
          <h3>Verify SMTP Email Delivery</h3>
          <p>
            Sends one message to your registered owner email, with configured default BCC. SMTP
            acceptance does not confirm inbox delivery.
          </p>
        </div>
        <button
          className="button"
          disabled={emailBusy || !!busy.smtp || health.smtp?.status !== 'connected' || !!failure}
          onClick={() => void sendTest()}
        >
          {emailBusy ? <Spinner /> : <Send size={16} />}Send Test Email
        </button>
        {emailResult && (
          <p role="status" className="email-notice">
            {emailResult}
          </p>
        )}
        <ErrorText>{emailError}</ErrorText>
        {emailError && (
          <div className="connection-actions">
            <span className="field-hint">
              Check your mailbox and the provider log before starting another test.
            </span>
            <button
              type="button"
              className="button small"
              disabled={emailBusy}
              onClick={() => {
                testId.current = undefined;
                setEmailError('');
              }}
            >
              Start Another Test
            </button>
          </div>
        )}
      </div>
      <details className="panel owner-connection-config">
        <summary>Google & Microsoft OAuth Apps</summary>
        <MailConnectionSettings connection={connection} />
      </details>
      <details className="panel owner-connection-config">
        <summary>Backend Environment Configuration</summary>
        <div className="panel-body">
          <p>
            Secrets are managed in the backend .env file or private hosting settings. Restart or
            redeploy after changing environment values, then sync status here.
          </p>
          <p>
            <strong>SMTP:</strong> SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL and
            optional SMTP_FROM_NAME. Use the provider-authorized mailbox as the From address. No
            manual SMTP form is needed. After updating the environment, restart or redeploy, then
            choose Test connection above.
          </p>
          <p>
            <strong>MongoDB:</strong> MONGODB_URI and MONGODB_DB. The test pings the active database
            connection. SQLite installations report MongoDB as not configured.
          </p>
          <p>
            <strong>Cloudinary:</strong> CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
            CLOUDINARY_API_SECRET. The test verifies the active Cloudinary client without uploading
            or deleting assets.
          </p>
        </div>
      </details>
    </section>
  );
}
