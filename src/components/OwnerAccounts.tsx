import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Globe,
  Copy,
  KeyRound,
  LockKeyholeOpen,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { masterRequest, restoreMasterSession, type MasterSession } from '../lib/master';
import { TwoFactorSettings } from './TwoFactorSettings';
import { CreatedDate } from './CreatedDate';
import type { WorkspaceUser } from '../domain/types';
import { Avatar, ErrorText, Field, Modal, Spinner } from './ui';
type OwnerAccount = WorkspaceUser & {
  mfaStatus: 'enabled' | 'pending' | 'not_configured';
  lockedUntil?: number;
  ownerLocked?: boolean;
  manuallyLocked?: boolean;
  accountStatus: 'Active' | 'Locked' | 'Disabled';
  lockedAt?: string;
};
export function OwnerAccounts({
  revision,
  ownerEmail,
  onOwnerMfaReset,
}: {
  revision?: number;
  ownerEmail: string;
  onOwnerMfaReset: (session: MasterSession) => void;
}) {
  const [users, setUsers] = useState<OwnerAccount[]>([]);
  const [domains, setDomains] = useState('');
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<OwnerAccount>();
  const [mfaTarget, setMfaTarget] = useState<OwnerAccount | 'owner'>();
  const [lockTarget, setLockTarget] = useState<OwnerAccount>();
  const [audit, setAudit] = useState<
    { id: string; action: string; userId: string; ownerEmail: string; createdAt: string }[]
  >([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [clearAudit, setClearAudit] = useState(false);
  const auditRequest = useRef(0);
  const loadAudit = useCallback(async () => {
    const request = ++auditRequest.current;
    setAuditLoading(true);
    try {
      const result = await masterRequest('/accounts/audit');
      if (request === auditRequest.current) setAudit(result.entries);
    } finally {
      if (request === auditRequest.current) setAuditLoading(false);
    }
  }, []);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const locked = useRef(false);
  const accountsRequest = useRef(0);
  const loadUsers = useCallback(async () => {
    const request = ++accountsRequest.current;
    const result = await masterRequest('/accounts');
    if (request === accountsRequest.current) setUsers(result.accounts);
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([loadUsers(), masterRequest('/domains')])
      .then(([, policy]) => {
        if (active) {
          setDomains(policy.domains.join('\n'));
        }
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
  }, [loadUsers]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (locked.current || document.visibilityState !== 'visible') return;
      void Promise.all([loadUsers(), ...(auditOpen ? [loadAudit()] : [])]).catch((cause) => {
        if (active) setError(cause.message);
      });
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      accountsRequest.current++;
      auditRequest.current++;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [revision, loadUsers, loadAudit, auditOpen]);
  async function run(kind: string, action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    accountsRequest.current++;
    auditRequest.current++;
    setAuditLoading(false);
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      await action();
      if (auditOpen && (kind === 'lock' || kind.startsWith('unlock:') || kind === 'audit-clear'))
        await loadAudit();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      locked.current = false;
      setBusy('');
    }
  }
  function closePasswordReset() {
    if (locked.current) return;
    setTarget(undefined);
    setTemporaryPassword('');
    setCopied(false);
    setError('');
  }
  return (
    <section className="panel owner-accounts-panel">
      <div className="panel-heading">
        <h2>
          <KeyRound size={18} /> Workspace Access
        </h2>
      </div>
      <div className="panel-body owner-access-grid" aria-busy={!!busy}>
        <section>
          <h3>
            <Globe size={17} /> Registered Domains
          </h3>
          <p className="section-description">
            New accounts must use an approved company domain. Public email providers are blocked.
            Removing a domain prevents new accounts; existing users retain access.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run('domains', async () => {
                const result = await masterRequest(
                  '/domains',
                  {
                    domains: domains
                      .split(/[\n,;]+/)
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                  'PUT',
                );
                setDomains(result.domains.join('\n'));
                setMessage('Registered domains saved.');
              });
            }}
          >
            <Field
              label="Approved Company Domains"
              hint="One domain per line. Register subdomains separately. An empty list blocks new accounts."
            >
              <textarea
                rows={4}
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="anvil.com.np"
                disabled={!!busy}
              />
            </Field>
            <button className="button primary" disabled={!!busy}>
              {busy === 'domains' ? <Spinner /> : <Save size={16} />}Save Domains
            </button>
          </form>
        </section>
        <section>
          <div className="owner-admin-heading">
            <h3>Workspace Accounts</h3>
            <button
              type="button"
              className="button small"
              disabled={!!busy}
              onClick={() => void run('refresh', loadUsers)}
            >
              {busy === 'refresh' ? <Spinner /> : <RefreshCw size={14} />}Refresh
            </button>
          </div>
          <p className="section-description">
            Lock accounts to stop sign-in and revoke current sessions. Super Admins can manage
            workspace locks; owner locks can only be removed here. Unlocking does not enable a
            disabled account.
          </p>
          {busy === 'load' ? (
            <p className="operation-status" role="status">
              <Spinner /> Loading accounts…
            </p>
          ) : users.length ? (
            users.map((user) => (
              <article className="owner-admin-row" key={user.id}>
                <Avatar name={user.name} photo={user.photo} />
                <div className="owner-account-identity">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <CreatedDate value={user.createdAt} />
                  <small>
                    {user.role === 'super_admin' ? 'Super Admin' : 'User'} · {user.accountStatus}
                  </small>
                  {user.manuallyLocked && (
                    <small className="owner-account-lock-status">
                      {user.ownerLocked ? 'Locked by owner' : 'Locked by workspace admin'}
                      {user.lockedAt ? ` · ${new Date(user.lockedAt).toLocaleString()}` : ''}
                    </small>
                  )}
                  {!!user.lockedUntil && user.lockedUntil > Date.now() && (
                    <small className="owner-account-lock-status">
                      Sign-in blocked until{' '}
                      {new Date(user.lockedUntil).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </small>
                  )}
                  <small
                    className={`owner-mfa-status ${user.mfaStatus === 'enabled' ? 'enabled' : ''}`}
                  >
                    <ShieldCheck size={13} />
                    {user.mfaStatus === 'enabled'
                      ? 'MFA enabled'
                      : user.mfaStatus === 'pending'
                        ? 'MFA setup in progress'
                        : 'MFA setup required'}
                  </small>
                </div>
                <div
                  className="owner-account-actions"
                  role="group"
                  aria-label={`Manage ${user.name}`}
                >
                  <button
                    type="button"
                    className="icon-button danger-button"
                    title="Lock Account"
                    aria-label={`Lock account for ${user.name}`}
                    disabled={
                      !!busy || !!user.ownerLocked || !user.active || user.email === ownerEmail
                    }
                    onClick={() => setLockTarget(user)}
                  >
                    <LockKeyhole size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button unlock-account"
                    disabled={!!busy}
                    aria-label={`Unlock sign-in for ${user.name}`}
                    title="Unlock Sign-In"
                    onClick={() =>
                      void run('unlock:' + user.id, async () => {
                        const result = await masterRequest(
                          '/accounts/unlock',
                          { id: user.id },
                          'POST',
                        );
                        setUsers(result.accounts);
                        setMessage(
                          user.active
                            ? `${user.name}: sign-in unblocked and failed attempts cleared.`
                            : `${user.name}: failed attempts cleared. This account is still disabled.`,
                        );
                      })
                    }
                  >
                    {busy === 'unlock:' + user.id ? <Spinner /> : <LockKeyholeOpen size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="Reset Password"
                    aria-label={`Reset password for ${user.name}`}
                    disabled={!!busy}
                    onClick={() => {
                      setTarget(user);
                      setTemporaryPassword('');
                      setCopied(false);
                      setError('');
                      setMessage('');
                    }}
                  >
                    <KeyRound size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="Reset MFA"
                    disabled={!!busy || user.mfaStatus === 'not_configured'}
                    aria-label={`Reset MFA for ${user.name}`}
                    onClick={() => {
                      setMfaTarget(user);
                      setError('');
                      setMessage('');
                    }}
                  >
                    <ShieldOff size={15} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="field-hint">
              No server accounts yet. Create the first administrator above after registering your
              company domain.
            </p>
          )}
        </section>
        <details
          className="owner-access-audit"
          onToggle={(event) => {
            setAuditOpen(event.currentTarget.open);
          }}
        >
          <summary>Account Access Audit</summary>
          <div className="owner-admin-heading audit-log-toolbar">
            <span className="field-hint">Most recent 100 account access actions</span>
            <div className="owner-account-actions">
              <button
                type="button"
                className="icon-button"
                title="Refresh Audit Log"
                aria-label="Refresh Audit Log"
                disabled={!!busy || auditLoading}
                onClick={() => void run('audit-refresh', loadAudit)}
              >
                {auditLoading ? <Spinner /> : <RefreshCw size={15} />}
              </button>
              <button
                type="button"
                className="icon-button danger-button"
                title="Clear Audit Log"
                aria-label="Clear Audit Log"
                disabled={!!busy || auditLoading || !audit.length}
                onClick={() => {
                  setError('');
                  setClearAudit(true);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          {audit.length ? (
            <ul>
              {audit.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.action === 'lock' ? 'Locked' : 'Unlocked'}</strong>{' '}
                  {users.find((user) => user.id === entry.userId)?.email || entry.userId} ·{' '}
                  {entry.ownerEmail} · {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No recorded lock or unlock actions.</p>
          )}
        </details>
        <section className="owner-self-recovery">
          <div>
            <h3>
              <ShieldCheck size={17} />
              Owner MFA Recovery
            </h3>
            <p className="section-description">
              Reset MFA for <strong>{ownerEmail}</strong> using a code sent to your registered
              email. You’ll need to set up a new authenticator before continuing in the Owner
              Portal.
            </p>
          </div>
          <button
            type="button"
            className="button"
            disabled={!!busy}
            onClick={() => {
              setMfaTarget('owner');
              setError('');
              setMessage('');
            }}
          >
            <ShieldOff size={16} />
            Reset Owner MFA
          </button>
        </section>
        {!target && !mfaTarget && !clearAudit && <ErrorText>{error}</ErrorText>}
        {message && (
          <p role="status" className="master-success">
            {message}
          </p>
        )}
      </div>
      {clearAudit && (
        <Modal
          title="Clear Account Access Audit Log"
          onClose={() => {
            if (!busy) setClearAudit(false);
          }}
        >
          <div className="modal-body">
            <p>
              Delete all recorded account lock and unlock actions? This cannot be undone. Account
              access, active locks and security settings will stay unchanged.
            </p>
            <ErrorText>{error}</ErrorText>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button"
              disabled={!!busy}
              onClick={() => setClearAudit(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button danger-button"
              disabled={!!busy}
              onClick={() =>
                void run('audit-clear', async () => {
                  await masterRequest('/accounts/audit/clear', { confirm: true });
                  setAudit([]);
                  setClearAudit(false);
                  setMessage('Account access audit log cleared.');
                })
              }
            >
              {busy === 'audit-clear' ? <Spinner /> : <Trash2 size={16} />}Clear Audit Log
            </button>
          </div>
        </Modal>
      )}
      {lockTarget && (
        <Modal
          title="Lock Workspace Account"
          subtitle={lockTarget.email}
          onClose={() => {
            if (!busy) setLockTarget(undefined);
          }}
        >
          <div className="modal-body">
            <p>
              Lock {lockTarget.name} and immediately sign them out of all sessions? Their records
              and permissions will be retained. Only the installation owner can unlock this account.
            </p>
            <ErrorText>{error}</ErrorText>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button"
              disabled={!!busy}
              onClick={() => setLockTarget(undefined)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                void run('lock', async () => {
                  const result = await masterRequest('/accounts/lock', { id: lockTarget.id });
                  setUsers(result.accounts);
                  setMessage(`${lockTarget.name} is locked. Existing sessions were revoked.`);
                  setLockTarget(undefined);
                })
              }
            >
              {busy === 'lock' ? <Spinner /> : <LockKeyhole size={16} />}Lock Account
            </button>
          </div>
        </Modal>
      )}
      {mfaTarget && (
        <Modal
          title={mfaTarget === 'owner' ? 'Reset Owner MFA' : 'Reset Workspace MFA'}
          subtitle={mfaTarget === 'owner' ? ownerEmail : mfaTarget.email}
          onClose={() => {
            if (!busy) {
              setMfaTarget(undefined);
              setError('');
            }
          }}
        >
          {mfaTarget === 'owner' ? (
            <div className="modal-body">
              <TwoFactorSettings
                kind="master"
                required
                initialAction="reset"
                onReset={() => {
                  const next = restoreMasterSession();
                  if (next) onOwnerMfaReset(next);
                }}
              />
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run('mfa', async () => {
                  const result = await masterRequest('/accounts/reset-mfa', {
                    id: mfaTarget.id,
                    confirm: true,
                  });
                  setUsers(result.accounts);
                  setMessage(
                    `MFA reset for ${mfaTarget.name}. They must set up a new authenticator at their next sign-in.`,
                  );
                  setMfaTarget(undefined);
                });
              }}
            >
              <div className="modal-body owner-mfa-confirmation">
                <p>
                  {`${mfaTarget.name}’s`} authenticator, recovery codes and trusted devices will be
                  removed. Existing sessions will be signed out. The password and business records
                  stay unchanged.
                </p>
                <p>
                  At their next sign-in, this user must set up a new authenticator before entering
                  the workspace.
                </p>
                <p className="field-hint">
                  No authenticator or recovery code is required to reset MFA.
                </p>
                <ErrorText>{error}</ErrorText>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button"
                  disabled={!!busy}
                  onClick={() => {
                    setMfaTarget(undefined);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={!!busy}>
                  {busy === 'mfa' ? <Spinner /> : <ShieldOff size={16} />}
                  Confirm MFA Reset
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {target && (
        <Modal title="Reset User Password" subtitle={target.email} onClose={closePasswordReset}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (locked.current || temporaryPassword) return;
              void run('reset', async () => {
                const result = await masterRequest('/accounts/reset-password', { id: target.id });
                setTemporaryPassword(result.temporaryPassword);
                setMessage(
                  `Temporary password generated for ${target.name}. They must replace it after signing in.`,
                );
                await loadUsers();
              });
            }}
          >
            <div className="modal-body">
              <p>
                {temporaryPassword
                  ? `Copy ${target.name}’s temporary password now and share it privately. It will not be shown again after closing this window.`
                  : `Generate a temporary password for ${target.name}? Their old password and existing sessions will stop working. They must choose a new password after signing in. Their MFA and company access stay unchanged.`}
              </p>
              {(!target.active || target.manuallyLocked) && (
                <p className="field-hint">
                  {target.active
                    ? 'This account is locked. Unlock it separately before the user can sign in.'
                    : 'This account is disabled. Enable it separately before the user can sign in.'}
                </p>
              )}
              {temporaryPassword && (
                <Field
                  label="Generated Temporary Password"
                  hint="Use this at workspace sign-in, then choose a personal password."
                >
                  <input
                    value={temporaryPassword}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    onFocus={(event) => event.target.select()}
                  />
                  <button
                    type="button"
                    className="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(temporaryPassword);
                        setCopied(true);
                      } catch {
                        setError('Select and copy the temporary password from the field above.');
                      }
                    }}
                  >
                    <Copy size={16} />
                    {copied ? 'Copied' : 'Copy Password'}
                  </button>
                </Field>
              )}
              <ErrorText>{error}</ErrorText>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                disabled={!!busy}
                onClick={closePasswordReset}
              >
                {temporaryPassword ? 'Done' : 'Cancel'}
              </button>
              {!temporaryPassword && (
                <button className="button primary" disabled={!!busy}>
                  {busy === 'reset' ? <Spinner /> : <KeyRound size={16} />}Generate temporary
                  password
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
