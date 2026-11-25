import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Download, ShieldCheck, Smartphone, Mail } from 'lucide-react';
import { ErrorText, Field, Spinner } from './ui';
import { TwoFactorCode } from './TwoFactorCode';
import { confirmTwoFactorSetup, twoFactorRequest } from '../lib/twoFactorClient';
import type { TwoFactorSetup, TwoFactorStatus } from '../lib/twoFactor';
export function TwoFactorSettings({
  kind = 'workspace',
  apiUrl = '',
  available = true,
  required = false,
  onRequiredComplete,
  onDirty,
  onReset,
  initialAction = 'idle',
  compact = false,
}: {
  kind?: 'workspace' | 'master';
  apiUrl?: string;
  available?: boolean;
  required?: boolean;
  onRequiredComplete?: () => void | Promise<void>;
  onDirty?: (value: boolean) => void;
  onReset?: () => void;
  initialAction?: 'idle' | 'reset';
  compact?: boolean;
}) {
  const [status, setStatus] = useState<TwoFactorStatus>();
  const [setup, setSetup] = useState<TwoFactorSetup>();
  const [manualSetup, setManualSetup] = useState(false);
  const [action, setAction] = useState<
    'idle' | 'setup' | 'disable' | 'recovery' | 'forget' | 'reset'
  >(initialAction);
  const [resetChallenge, setResetChallenge] = useState<{
    resetToken: string;
    email: string;
    expiresAt: number;
  }>();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const actionPending = useRef(false);
  const enrollment = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (setup) {
      enrollment.current?.focus({ preventScroll: true });
      enrollment.current?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  }, [setup]);
  const sensitive = !!(codes.length || setup || action !== 'idle' || password || code);
  useEffect(() => {
    onDirty?.(sensitive);
  }, [sensitive, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  useEffect(() => {
    if (!available) return;
    let active = true;
    twoFactorRequest(kind, apiUrl)
      .then((value) => {
        if (active) {
          setStatus(value);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [kind, apiUrl, available, reload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (codes.length || setup) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [codes.length, setup]);
  function clear() {
    setAction('idle');
    setSetup(undefined);
    setManualSetup(false);
    setPassword('');
    setCode('');
    setRecovery(false);
    setResetChallenge(undefined);
    setError('');
  }
  async function run(task: () => Promise<void>) {
    if (busy || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (setup) await twoFactorRequest(kind, apiUrl, '/cancel', {});
    clear();
  }
  return (
    <section
      className={`profile-panel two-factor-settings ${compact ? 'two-factor-compact' : ''}`}
      aria-label="Two-Factor Authentication"
    >
      {compact ? (
        <ol className="two-factor-steps" aria-label="Enrollment Progress">
          {['Password', 'Authenticator', 'Recovery Codes'].map((label, index) => {
            const step = codes.length ? 2 : setup ? 1 : 0;
            return (
              <li
                key={label}
                aria-current={index === step ? 'step' : undefined}
                className={index < step ? 'is-complete' : ''}
              >
                <span aria-hidden="true">
                  {index < step ? <CheckCircle2 size={14} /> : index + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="profile-panel-heading">
          <ShieldCheck size={20} />
          <div>
            <h2>Two-Factor Authentication</h2>
            <p>
              {status?.enabled
                ? 'Manage your authenticator and trusted devices.'
                : required
                  ? 'Set up an authenticator to secure this account before continuing.'
                  : 'Add an authenticator code after your password.'}
            </p>
          </div>
          {status && (
            <span className={`two-factor-badge ${status.enabled ? 'enabled' : ''}`}>
              {status.enabled ? 'Enabled' : 'Not enabled'}
            </span>
          )}
        </div>
      )}
      {!available ? (
        <div className="two-factor-explainer">
          <Smartphone size={24} />
          <div>
            <strong>Available With Server Accounts</strong>
            <p>
              Ask the owner to configure a shared workspace, then sign in with your server account
              to enable 2FA. Offline-only accounts continue to use encrypted browser storage.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!status && !error && (
            <p className="two-factor-notice">
              <Spinner />
              Loading security settings…
            </p>
          )}
          {!!codes.length ? (
            <div className="two-factor-recovery">
              <span className="two-factor-success">
                <CheckCircle2 size={18} />
                Two-factor security updated
              </span>
              <h3>Save Your Recovery Codes</h3>
              <p>
                Keep these in a private password manager or print them. Each code works once if you
                lose access to your authenticator. These codes will not be shown again.
              </p>
              <div className="recovery-code-grid">
                {codes.map((value) => (
                  <code key={value}>{value}</code>
                ))}
              </div>
              <div className="two-factor-actions">
                <button
                  type="button"
                  className="button small"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(codes.join('\n'));
                      setMessage('Recovery Codes copied.');
                    })
                  }
                >
                  <Copy size={15} />
                  Copy Recovery Codes
                </button>
                <button
                  type="button"
                  className="button small"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        `Anvil Technologies — ${kind} 2FA recovery codes\nKeep private. Each code works once.\n\n${codes.join('\n')}\n`,
                      ],
                      { type: 'text/plain' },
                    );
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'anvil-2fa-recovery-codes.txt';
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <Download size={15} />
                  Download Codes
                </button>
              </div>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                I Have Saved My Recovery Codes Securely
              </label>
              <button
                type="button"
                className="button primary"
                disabled={!saved || busy}
                onClick={() => {
                  setCodes([]);
                  setSaved(false);
                  setMessage('Two-factor authentication is ready.');
                  if (required) void onRequiredComplete?.();
                }}
              >
                Done
              </button>
            </div>
          ) : action === 'idle' ? (
            <>
              {status && (
                <>
                  <p className="two-factor-notice">
                    {status.enabled
                      ? `Your sign-in is protected. ${status.recoveryCodesRemaining} recovery codes remain.`
                      : 'Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app. No SMS or email service is required.'}
                  </p>
                  <div className="two-factor-actions">
                    {status.enabled ? (
                      <>
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            clear();
                            setMessage('');
                            setAction('reset');
                          }}
                        >
                          <Mail size={16} /> Reset MFA By Email
                        </button>
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            clear();
                            setMessage('');
                            setAction('forget');
                          }}
                        >
                          Forget Trusted Devices
                        </button>
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            clear();
                            setMessage('');
                            setAction('recovery');
                          }}
                        >
                          Generate New Recovery Codes
                        </button>
                        {!required && (
                          <button
                            type="button"
                            className="button"
                            onClick={() => {
                              clear();
                              setMessage('');
                              setAction('disable');
                            }}
                          >
                            Turn Off 2FA
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => {
                          clear();
                          setMessage('');
                          setAction('setup');
                        }}
                      >
                        <Smartphone size={16} />
                        {required ? 'Set Up Required 2FA' : 'Set Up 2FA'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (action === 'reset') {
                    if (!resetChallenge) {
                      if (!password) throw new Error('Enter your current account password.');
                      setResetChallenge(
                        await twoFactorRequest(kind, apiUrl, '/reset/request', { password }),
                      );
                      setPassword('');
                      setCode('');
                    } else {
                      if (!/^\d{6}$/.test(code))
                        throw new Error('Enter the six-digit code from your reset email.');
                      if (Date.now() >= resetChallenge.expiresAt)
                        throw new Error('This code has expired. Request a new code.');
                      await twoFactorRequest(kind, apiUrl, '/reset/confirm', {
                        resetToken: resetChallenge.resetToken,
                        code,
                      });
                      clear();
                      onDirty?.(false);
                      onReset?.();
                    }
                    return;
                  }
                  if (action === 'forget') {
                    if (!/^\d{6}$/.test(code))
                      throw new Error('Enter the 6-digit code from your authenticator app.');
                    await twoFactorRequest(kind, apiUrl, '/forget-devices', { code });
                    clear();
                    setMessage(
                      'Trusted devices removed. Your next sign-in will require two-factor verification.',
                    );
                    return;
                  }
                  if (action === 'setup' && !setup) {
                    setSetup(await twoFactorRequest(kind, apiUrl, '/setup', { password }));
                    setPassword('');
                    return;
                  }
                  const result =
                    action === 'setup'
                      ? await confirmTwoFactorSetup(kind, apiUrl, code)
                      : await twoFactorRequest(kind, apiUrl, `/${action}`, {
                          password,
                          code,
                          recovery,
                        });
                  setStatus({
                    enabled: result.enabled,
                    recoveryCodesRemaining: result.recoveryCodesRemaining,
                  });
                  clear();
                  if (result.recoveryCodes) {
                    setCodes(result.recoveryCodes);
                    setSaved(false);
                  } else setMessage('Two-factor authentication turned off.');
                });
              }}
            >
              <fieldset disabled={busy}>
                {action === 'reset' ? (
                  <>
                    <h3>{resetChallenge ? 'Check Your Email' : 'Reset Your Authenticator'}</h3>
                    <p className="two-factor-notice">
                      {resetChallenge
                        ? `We sent a six-digit reset code to ${resetChallenge.email}. It expires in 10 minutes. Your current MFA stays active until you verify it.`
                        : 'Confirm your password to receive a reset code at your registered email. After verification, you must enroll a new authenticator. Old recovery codes, trusted devices and sessions will be revoked.'}
                    </p>
                    {resetChallenge ? (
                      <Field
                        label="Email Reset Code"
                        hint="Enter the code from your latest MFA reset email."
                      >
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          required
                        />
                      </Field>
                    ) : (
                      <Field label="Account Password">
                        <input
                          type="password"
                          autoComplete="current-password"
                          maxLength={256}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </Field>
                    )}
                    {resetChallenge && (
                      <button
                        type="button"
                        className="button small ghost"
                        disabled={busy}
                        onClick={() => {
                          setResetChallenge(undefined);
                          setCode('');
                          setError('');
                        }}
                      >
                        Request A New Code
                      </button>
                    )}
                  </>
                ) : setup ? (
                  <div
                    className={`two-factor-enrollment ${compact && manualSetup ? 'is-manual' : ''}`}
                    ref={enrollment}
                    tabIndex={-1}
                    role="group"
                    aria-label="Link Your Authenticator"
                  >
                    {(!compact || !manualSetup) && (
                      <div className="two-factor-qr">
                        <img
                          src={setup.qrCode}
                          alt="Scan this QR code in your authenticator app"
                          width="224"
                          height="224"
                        />
                      </div>
                    )}
                    <div>
                      <h3>
                        {compact
                          ? manualSetup
                            ? 'Enter The Setup Key'
                            : 'Scan The QR Code'
                          : 'Scan With Your Authenticator'}
                      </h3>
                      <p>
                        {compact ? (
                          manualSetup ? (
                            'Add a time-based account in your authenticator using this key.'
                          ) : (
                            'Scan this code in your authenticator app. Setup expires in 10 minutes.'
                          )
                        ) : (
                          <>
                            Add a new account in your authenticator app, scan this code, then enter
                            the six-digit code below. Setup expires in 10 minutes.
                          </>
                        )}
                      </p>
                      <details onToggle={(event) => setManualSetup(event.currentTarget.open)}>
                        <summary>
                          {compact
                            ? manualSetup
                              ? 'Show QR Code Instead'
                              : 'Use A Setup Key Instead'
                            : 'Enter The Setup Key Manually'}
                        </summary>
                        <code className="two-factor-secret">{setup.secret}</code>
                        <small>Time based · 6 digits · 30 seconds · SHA-1</small>
                      </details>
                    </div>
                  </div>
                ) : action === 'forget' ? (
                  <>
                    <h3>Forget Trusted Devices</h3>
                    <p className="two-factor-notice">
                      Verify with your authenticator to remove all trusted devices for this account,
                      including this browser. You’ll stay signed in, and your next sign-in will
                      require 2FA.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>
                      {action === 'setup'
                        ? 'Confirm Your Password'
                        : action === 'disable'
                          ? 'Turn Off Two-Factor Authentication'
                          : 'Replace Your Recovery Codes'}
                    </h3>
                    <p className="two-factor-notice">
                      {action === 'disable'
                        ? 'Your next sign-in will only require your password. Other sessions will be signed out.'
                        : action === 'recovery'
                          ? 'Your existing recovery codes will stop working. Save the replacement codes after verification.'
                          : 'Your password is required before linking an authenticator.'}
                    </p>
                    <Field label="Account Password">
                      <input
                        type="password"
                        autoComplete="current-password"
                        maxLength={256}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </Field>
                  </>
                )}
                {action !== 'reset' &&
                  (setup || action !== 'setup') &&
                  (action === 'setup' ? (
                    <Field
                      label="Setup Verification Code"
                      hint={
                        compact
                          ? 'Enter the 6-digit code from your authenticator.'
                          : 'Enter the current 6-digit code shown in your authenticator.'
                      }
                    >
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        placeholder="000000"
                        required
                      />
                    </Field>
                  ) : (
                    <TwoFactorCode
                      code={code}
                      onCode={setCode}
                      recovery={recovery}
                      onRecovery={setRecovery}
                      allowRecovery={action !== 'forget'}
                      disabled={busy}
                    />
                  ))}
                <div className="two-factor-actions">
                  <button className="button primary" disabled={busy}>
                    {busy && <Spinner />}
                    {action === 'reset'
                      ? resetChallenge
                        ? 'Verify Email & Reset MFA'
                        : 'Send Reset Code'
                      : action === 'setup'
                        ? setup
                          ? 'Verify & Enable 2FA'
                          : 'Continue To Authenticator'
                        : action === 'forget'
                          ? 'Verify & Forget Devices'
                          : action === 'disable'
                            ? 'Confirm Turn Off'
                            : 'Replace Recovery Codes'}
                  </button>
                  {(!required || action !== 'setup') && (
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => void run(cancel)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}
          <ErrorText>{error}</ErrorText>
          {!status && error && (
            <button className="button small" type="button" onClick={() => setReload((v) => v + 1)}>
              Retry Security Settings
            </button>
          )}
          {message && (
            <p className="two-factor-success" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
