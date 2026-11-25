import { ThemeControl } from '../components/ThemeControl';
import { useEffect, useState } from 'react';
import { KeyRound, Settings2 } from 'lucide-react';
import type { WorkspaceUser } from '../domain/types';
import { ErrorText, Field, Spinner } from '../components/ui';
import { MailboxConnection } from '../components/MailConnections';
import { TwoFactorSettings } from '../components/TwoFactorSettings';

export function AccountSettings({
  user,
  isRemote,
  apiUrl,
  twoFactorRequired = false,
  onPassword,
  onDirty,
  notify,
  onMfaReset,
}: {
  user: WorkspaceUser;
  isRemote: boolean;
  apiUrl?: string;
  twoFactorRequired?: boolean;
  onPassword: (current: string, next: string) => Promise<void>;
  onDirty: (dirty: boolean) => void;
  notify: (message: string) => void;
  onMfaReset: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [twoFactorDirty, setTwoFactorDirty] = useState(false);
  useEffect(() => {
    onDirty(!!current || !!next || !!confirm || twoFactorDirty || busy);
  }, [current, next, confirm, twoFactorDirty, busy, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  return (
    <div className="account-settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>Settings</h1>
          <p>Manage your password, sign-in security, and sending mailbox.</p>
        </div>
      </div>
      <div className="account-settings-identity">
        <Settings2 size={20} />
        <div>
          <strong>Personal Settings</strong>
          <span>{user.email}</span>
        </div>
      </div>
      <ThemeControl />
      <div className="profile-forms">
        <form
          className="profile-panel profile-security-section"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            setPasswordError('');
            if (!current || next.length < 12 || next !== confirm) {
              setPasswordError(
                !current
                  ? 'Enter your current password.'
                  : next.length < 12
                    ? 'Use a new password with at least 12 characters.'
                    : 'Your new passwords do not match.',
              );
              return;
            }
            setBusy(true);
            try {
              await onPassword(current, next);
              setCurrent('');
              setNext('');
              setConfirm('');
              notify('Password changed');
            } catch (error) {
              setPasswordError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="profile-panel-heading">
            <KeyRound size={19} />
            <div>
              <h2>Password & Security</h2>
              <p>
                {isRemote
                  ? 'Change your server password and revoke other active sessions.'
                  : 'Change the password for your sign-in on this browser.'}
              </p>
            </div>
          </div>
          <fieldset disabled={!!busy}>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user.email}
              readOnly
              className="sr-only"
              tabIndex={-1}
              aria-label="Account Email"
            />
            <Field label="Current Password">
              <input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="New Password" hint="Use at least 12 characters.">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </Field>
              <Field label="Confirm New Password">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </Field>
            </div>
            <ErrorText>{passwordError}</ErrorText>
            <div className="profile-actions">
              <button className="button" disabled={!!busy}>
                {busy ? <Spinner /> : <KeyRound size={16} />}Change Password
              </button>
            </div>
          </fieldset>
        </form>
        {apiUrl && isRemote && <MailboxConnection apiUrl={apiUrl} email={user.email} />}
        <TwoFactorSettings
          apiUrl={apiUrl}
          available={isRemote}
          required={twoFactorRequired}
          onDirty={setTwoFactorDirty}
          onReset={onMfaReset}
        />
      </div>
    </div>
  );
}
