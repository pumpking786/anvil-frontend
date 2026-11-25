import { OwnerCompanies } from '../components/OwnerCompanies';
import { PortalArtwork } from '../components/PortalArtwork';
import { ThemeToggle } from '../components/ThemeControl';
import { usePageTitle } from '../lib/pageTitle';
import { OwnerBrandSettings } from '../components/OwnerBrandSettings';
import { OwnerLogo } from '../components/OwnerLogo';
import { OwnerProfile, OwnerSettings } from '../components/OwnerAccount';
import { WelcomeNotice } from '../components/WelcomeNotice';
import {
  setFaviconSource,
  useInstallationBrand,
  resolveLoginBrand,
  type InstallationBrand,
} from '../lib/installationBrand';
import { OwnerAccounts } from '../components/OwnerAccounts';
import { TwoFactorCode } from '../components/TwoFactorCode';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import { TwoFactorRequired, type TwoFactorChallenge } from '../lib/twoFactor';
import { verifyMasterTwoFactor } from '../lib/master';
import { LOGIN_POLICY_TEXT } from '../lib/loginPolicy';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Settings2,
  UserRound,
} from 'lucide-react';
import { LoginPresentation } from '../components/LoginPresentation';
import { OwnerConnections } from '../components/OwnerConnections';
import { FirstAdministratorForm } from '../components/FirstAdministratorForm';
import { ErrorText, Field, Spinner } from '../components/ui';
import { createAccount, publicBranding } from '../lib/auth';
import {
  restoreMasterSession,
  resumeMasterSession,
  configureMasterPersistence,
  changeMasterPassword,
  masterRequest,
  masterSignIn,
  masterSignOut,
  type MasterConfiguration,
  type MasterSession,
} from '../lib/master';
import { emptyWorkspace } from '../domain/defaults';
import { sampleWorkspace } from '../domain/sample';
import { rememberServer } from '../lib/session';
import type { VaultData } from '../domain/types';
const blankCompany = { name: '', address: '', phone: '', email: '', pan: '' };
export function MasterPortal({
  exists,
  initialUrl,
  onBack,
  onLogin,
}: {
  exists: boolean;
  initialUrl: string;
  onBack: () => void;
  onLogin: (data: VaultData) => Promise<void>;
}) {
  const installationBrand = useInstallationBrand();
  const [brandPreview, setBrandPreview] =
    useState<
      Pick<InstallationBrand, 'ownerLogo' | 'ownerLogoWidth' | 'ownerAppName' | 'ownerAppSubtitle'>
    >();
  const ownerBrand = brandPreview || installationBrand;
  const ownerLoginBrand = resolveLoginBrand(
    { ...installationBrand, ...brandPreview },
    publicBranding(),
    true,
  );
  const [challenge, setChallenge] = useState<TwoFactorChallenge>();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [restoringSession, setRestoringSession] = useState(true);
  const [security, setSecurity] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityDirty, setSecurityDirty] = useState(false);
  const [session, setSession] = useState<MasterSession | undefined>(() => restoreMasterSession());
  const [url, setUrl] = useState(initialUrl);
  useEffect(() => {
    setFaviconSource(url);
  }, [url]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [replacement, setReplacement] = useState('');
  const [confirmMaster, setConfirmMaster] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [configuration, setConfiguration] = useState<MasterConfiguration>();
  const [storage, setStorage] = useState<'local' | 'remote'>('remote');
  const [company, setCompany] = useState(blankCompany);
  const [prefix, setPrefix] = useState('ANV');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [welcome, setWelcome] = useState(false);
  const pendingWelcome = useRef(false);
  useEffect(() => {
    if (
      session &&
      !session.mustChangePassword &&
      !session.mustSetupTwoFactor &&
      pendingWelcome.current
    ) {
      pendingWelcome.current = false;
      setWelcome(true);
    }
  }, [session]);
  const [dirty, setDirty] = useState(false);
  const configured = storage === 'remote' && configuration?.configured;
  const needsAdmin = storage === 'local' || (!configured && configuration?.needsAdministrator);
  useEffect(() => {
    const expire = () => {
      setSession(undefined);
      setWelcome(false);
      pendingWelcome.current = false;
      setChallenge(undefined);
      setCode('');
      setSecurity(false);
      setProfileOpen(false);
      setConfiguration(undefined);
      setPassword('');
      setReplacement('');
      setConfirmMaster('');
      setAdminPassword('');
      setConfirm('');
      setError('Your owner session expired. Sign in again to continue.');
    };
    window.addEventListener('patra-master-expired', expire);
    return () => {
      window.removeEventListener('patra-master-expired', expire);
    };
  }, []);
  useEffect(() => {
    let active = true;
    void resumeMasterSession(url)
      .then(async (restored) => {
        if (!active || !restored) return;
        setSession(restored);
        if (!restored.mustChangePassword && !restored.mustSetupTwoFactor) await load(() => active);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      })
      .finally(() => {
        if (active) setRestoringSession(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session || session.mustChangePassword || session.mustSetupTwoFactor) return;
    let active = true,
      refreshing = false;
    const refresh = async () => {
      if (dirty || busy || securityDirty || refreshing || document.visibilityState !== 'visible')
        return;
      refreshing = true;
      try {
        await load(() => active);
      } catch {
        /* Preserve the last known configuration during an outage. */
      } finally {
        refreshing = false;
      }
    };
    const timer = setInterval(() => void refresh(), 5000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [session, dirty, busy, securityDirty]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || busy || securityDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty, busy, securityDirty]);
  function leave() {
    masterSignOut();
    onBack();
  }
  function goToWorkspace() {
    rememberServer(url, storage);
    leave();
  }
  async function load(accept = () => true) {
    const value: MasterConfiguration = await masterRequest('/workspace');
    if (!accept()) return;
    setConfiguration(value);
    const mode = value.remoteEnabled ? 'remote' : 'local';
    setStorage(mode);
    setCompany(mode === 'remote' && value.company ? value.company : blankCompany);
    setPrefix(value.quotePrefix);
    setDirty(false);
  }
  const actionPending = useRef(false);
  async function run(action: () => Promise<void>) {
    if (busy || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      if (err instanceof TwoFactorRequired) {
        setChallenge(err.challenge);
        setPassword('');
        setCode('');
        return;
      }
      setError((err as Error).message);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  const passwordScreen = session && (session.mustChangePassword || changingPassword);
  const twoFactorSetupScreen =
    !!session && !session.mustChangePassword && !!session.mustSetupTwoFactor;
  usePageTitle(
    challenge
      ? 'Verify Owner Access'
      : passwordScreen
        ? 'Secure Owner Account'
        : twoFactorSetupScreen
          ? 'Owner MFA Setup'
          : !session
            ? 'Owner Sign In'
            : profileOpen
              ? 'Owner Profile'
              : security
                ? 'Owner Settings'
                : 'Owner Portal',
  );
  if (!session || passwordScreen || twoFactorSetupScreen)
    return (
      <LoginPresentation
        dialog={
          challenge || passwordScreen || twoFactorSetupScreen
            ? {
                title: challenge
                  ? 'Verify Owner Access'
                  : twoFactorSetupScreen
                    ? 'Protect Your Owner Account'
                    : passwordScreen
                      ? 'Secure Your Owner Account'
                      : 'Owner Sign In',
                enrollment: twoFactorSetupScreen,
                onClose: () => {
                  if (busy) return;
                  if (challenge) {
                    setChallenge(undefined);
                    setCode('');
                    setRecovery(false);
                    setRememberDevice(false);
                    setError('');
                  } else if (changingPassword && !session?.mustChangePassword) {
                    setChangingPassword(false);
                    setPassword('');
                    setReplacement('');
                    setConfirmMaster('');
                    setError('');
                  } else leave();
                },
              }
            : undefined
        }
        brand={{
          ...ownerLoginBrand,
          ownerAppName: ownerBrand.ownerAppName,
          ownerAppSubtitle: ownerBrand.ownerAppSubtitle,
        }}
      >
        {!challenge && !passwordScreen && !twoFactorSetupScreen && (
          <h2>{restoringSession ? 'Restoring Your Session' : 'Owner Sign In'}</h2>
        )}
        {!twoFactorSetupScreen && (
          <p className="login-description">
            {passwordScreen
              ? 'Choose a private password before managing workspace configuration.'
              : challenge
                ? 'Enter your authenticator code to finish signing in. This step expires in 5 minutes.'
                : 'Sign in to manage your workspace.'}
          </p>
        )}
        {twoFactorSetupScreen ? (
          <TwoFactorSettings
            kind="master"
            required
            compact
            onRequiredComplete={() => {
              void run(async () => {
                await configureMasterPersistence(keepSignedIn);
                await load();
                setSession((current) =>
                  current ? { ...current, mustSetupTwoFactor: false } : current,
                );
              });
            }}
          />
        ) : (
          <>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  if (passwordScreen) {
                    if (replacement.length < 12 || replacement.length > 256)
                      throw new Error('Use a password of 12–256 characters.');
                    if (replacement !== confirmMaster)
                      throw new Error('Your new passwords do not match.');
                    const next = await changeMasterPassword(password, replacement);
                    setSession(next);
                    setChangingPassword(false);
                    setPassword('');
                    setReplacement('');
                    setConfirmMaster('');
                    if (!next.mustSetupTwoFactor) {
                      await configureMasterPersistence(keepSignedIn);
                      await load();
                    }
                  } else {
                    const next = challenge
                      ? await verifyMasterTwoFactor(
                          url,
                          challenge.challengeToken,
                          code,
                          recovery,
                          rememberDevice,
                        )
                      : await masterSignIn(url, email, password);
                    pendingWelcome.current = true;
                    setChallenge(undefined);
                    setCode('');
                    setRecovery(false);
                    setSession(next);
                    setPassword('');
                    if (!next.mustChangePassword && !next.mustSetupTwoFactor) {
                      setSession(await configureMasterPersistence(keepSignedIn));
                      await load();
                    }
                  }
                });
              }}
            >
              {!passwordScreen && !challenge && !twoFactorSetupScreen && (
                <>
                  <Field label="Owner Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </Field>
                </>
              )}
              {!challenge && !twoFactorSetupScreen && (
                <Field label={passwordScreen ? 'Current Owner Password' : 'Owner Password'}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    maxLength={256}
                    required
                  />
                </Field>
              )}
              {!challenge && !passwordScreen && (
                <label className="checkbox-line keep-signed-in">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    disabled={busy || restoringSession}
                  />
                  <span>Keep Me Signed In For 1 Week</span>
                </label>
              )}
              {challenge && (
                <TwoFactorCode
                  code={code}
                  onCode={setCode}
                  recovery={recovery}
                  onRecovery={setRecovery}
                  rememberDevice={rememberDevice}
                  onRememberDevice={setRememberDevice}
                  disabled={busy}
                />
              )}
              {passwordScreen && (
                <>
                  <Field
                    label="New Owner Password"
                    hint="At least 12 characters; different from the temporary password."
                  >
                    <input
                      type="password"
                      value={replacement}
                      onChange={(e) => setReplacement(e.target.value)}
                      autoComplete="new-password"
                      maxLength={256}
                      required
                    />
                  </Field>
                  <Field label="Confirm New Owner Password">
                    <input
                      type="password"
                      value={confirmMaster}
                      onChange={(e) => setConfirmMaster(e.target.value)}
                      autoComplete="new-password"
                      maxLength={256}
                      required
                    />
                  </Field>
                </>
              )}
              <ErrorText>{error}</ErrorText>
              <button className="button primary login-submit" disabled={busy || restoringSession}>
                {busy && <Spinner />}
                {challenge
                  ? 'Verify & Sign In'
                  : passwordScreen
                    ? 'Save Owner Password'
                    : 'Sign In As Owner'}
                <ArrowRight size={17} />
              </button>
            </form>
            {challenge && (
              <button
                type="button"
                className="button ghost two-factor-back"
                disabled={busy}
                onClick={() => {
                  setChallenge(undefined);
                  setCode('');
                  setRecovery(false);
                  setError('');
                }}
              >
                Back To Password
              </button>
            )}
          </>
        )}
        {!challenge && !twoFactorSetupScreen && (
          <div className="login-security-footer login-owner-footer">
            <details className="login-connection-details" name="owner-login-options">
              <summary>Connection Settings</summary>
              <Field label="Owner Service URL">
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
              </Field>
            </details>
            <details className="login-policy-details" name="owner-login-options">
              <summary>Account Security</summary>
              <p>
                Owner access tokens renew securely while Keep me signed in is active, for up to 7
                days. Two-factor authentication is required. {LOGIN_POLICY_TEXT}
              </p>
            </details>
            <button type="button" className="button ghost" disabled={busy} onClick={leave}>
              <ArrowLeft size={16} />
              Back To Workspace Login
            </button>
          </div>
        )}
      </LoginPresentation>
    );
  return (
    <main className="master-console">
      {welcome && <WelcomeNotice name={session.email.split('@')[0]} />}
      <header className="master-console-header">
        <div className="master-console-brand">
          <OwnerLogo src={ownerBrand.ownerLogo} width={ownerBrand.ownerLogoWidth} />
          <div>
            <strong>{ownerBrand.ownerAppName || 'Anvil Technologies'}</strong>
            <span>{ownerBrand.ownerAppSubtitle || 'Business Forge Platform'}</span>
          </div>
        </div>
        <div className="master-console-account">
          <ThemeToggle />
          <span>
            {session.email}
            <small>Installation owner</small>
          </span>
          <button
            className="button small"
            disabled={busy}
            onClick={() => {
              setProfileOpen(true);
            }}
          >
            <UserRound size={15} />
            My Profile
          </button>
          <button
            type="button"
            className="button small"
            disabled={busy}
            onClick={() => setSecurity(true)}
          >
            <Settings2 size={15} />
            Settings
          </button>
          <button
            className="icon-button"
            aria-label="Log Out Owner Account"
            title="Log Out"
            disabled={busy}
            onClick={() => {
              masterSignOut();
              setBrandPreview(undefined);
              setSession(undefined);
              setWelcome(false);
              pendingWelcome.current = false;
              setChallenge(undefined);
              setConfiguration(undefined);
              setPassword('');
              setCode('');
              setSecurity(false);
              setProfileOpen(false);
              setDirty(false);
              setError('');
            }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <div className="master-console-body">
        <PortalArtwork />
        <div className="master-console-intro">
          <span className="eyebrow">Installation management</span>
          <h1>Workspace Configuration</h1>
          <p>
            Create a business workspace, choose where it is stored, and set up its administrator.
          </p>
        </div>
        {configuration?.configured &&
          configuration.needsAdministrator &&
          configuration.remoteEnabled && (
            <FirstAdministratorForm
              onCreated={(next) => {
                setConfiguration(next);
                rememberServer(url, 'remote');
                setStorage('remote');
                setMessage(
                  'Administrator created. Use the email and password you just set at the workspace login.',
                );
              }}
            />
          )}
        {configuration?.configured && !configuration.needsAdministrator && <OwnerCompanies />}
        <div className="master-console-grid">
          <aside className="master-guide">
            <span className="master-badge">
              <ShieldCheck size={15} />
              Owner verified
            </span>
            <h2>A Secure Start For Your Team</h2>
            <ol>
              <li>
                <strong>Choose Storage</strong>
                <span>A shared server or this browser.</span>
              </li>
              <li>
                <strong>Configure Your Business</strong>
                <span>Company details and quotation prefix.</span>
              </li>
              <li>
                <strong>Open Your Workspace</strong>
                <span>Use a workspace account for day-to-day work.</span>
              </li>
            </ol>
            <p>
              Super admins manage branding, quotation layouts and team access inside the workspace.
            </p>
            <button className="button small" disabled={busy} onClick={() => void run(load)}>
              <RefreshCw size={14} />
              Refresh Configuration
            </button>
          </aside>
          <section className="panel master-setup-panel">
            <div className="panel-heading">
              <h2>
                <Building2 size={18} />
                {configured ? 'Configure Original Workspace' : 'Create Workspace'}
              </h2>
              <span className="mini-tag">{configured ? 'CONFIGURED' : 'SETUP'}</span>
            </div>
            {!configuration ? (
              <div className="panel-body">
                <ErrorText>{error}</ErrorText>
                <p>
                  {busy
                    ? 'Loading configuration…'
                    : 'Configuration could not be loaded. Refresh to try again.'}
                </p>
              </div>
            ) : (
              <form
                className="panel-body"
                noValidate
                onChange={() => {
                  setDirty(true);
                  setMessage('');
                  setError('');
                }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    if (!company.name.trim()) throw new Error('Enter your business name.');
                    if (!/^[a-zA-Z0-9_-]{1,12}$/.test(prefix))
                      throw new Error(
                        'Use 1–12 letters, numbers, hyphens or underscores for the quotation prefix.',
                      );
                    if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email))
                      throw new Error('Enter a valid company email address.');
                    if (needsAdmin) {
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()))
                        throw new Error('Enter a valid administrator email address.');
                      if (adminPassword.length < 12 || adminPassword.length > 256)
                        throw new Error('Use an administrator password of 12–256 characters.');
                      if (adminPassword !== confirm)
                        throw new Error('Your administrator passwords do not match.');
                    }
                    if (configured) {
                      const next = await masterRequest(
                        '/workspace',
                        { company: { ...company, name: company.name.trim() }, quotePrefix: prefix },
                        'PUT',
                        configuration.revision,
                      );
                      setConfiguration(next);
                      setDirty(false);
                      setMessage('Workspace configuration saved.');
                      return;
                    }
                    const workspace = sample
                      ? sampleWorkspace(company.name.trim())
                      : emptyWorkspace(company.name.trim());
                    workspace.company = {
                      ...workspace.company,
                      ...company,
                      name: company.name.trim(),
                    };
                    workspace.settings.quotePrefix = prefix;
                    const administrator = {
                      name: adminName.trim() || adminEmail.trim().split('@')[0],
                      email: adminEmail.trim().toLowerCase(),
                      password: adminPassword,
                    };
                    if (storage === 'remote') {
                      const next = await masterRequest('/workspace', { workspace, administrator });
                      setConfiguration(next);
                      rememberServer(url, 'remote');
                      setDirty(false);
                      setAdminPassword('');
                      setConfirm('');
                      setMessage('Server workspace created. Your administrator can now sign in.');
                    } else {
                      if (exists)
                        throw new Error(
                          'This browser already has a workspace. Sign in to manage it.',
                        );
                      workspace.users = [
                        {
                          id: crypto.randomUUID(),
                          name: administrator.name,
                          email: administrator.email,
                          role: 'super_admin',
                          active: true,
                          createdAt: new Date().toISOString(),
                        },
                      ];
                      const data: VaultData = {
                        email: administrator.email,
                        workspace,
                        connection: { mode: 'local', url: '', token: '' },
                      };
                      await createAccount(administrator.email, adminPassword, data);
                      rememberServer(url, 'local');
                      setDirty(false);
                      masterSignOut();
                      history.replaceState(null, '', '/');
                      await onLogin(data);
                    }
                  });
                }}
              >
                <div className="master-storage" role="group" aria-label="Workspace Storage">
                  {(['remote', 'local'] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      disabled={busy || (mode === 'remote' && !configuration.remoteEnabled)}
                      aria-pressed={storage === mode}
                      onClick={() => {
                        setStorage(mode);
                        setCompany(
                          mode === 'remote' && configuration.company
                            ? configuration.company
                            : blankCompany,
                        );
                        setPrefix(mode === 'remote' ? configuration.quotePrefix : 'ANV');
                        setDirty(false);
                        setMessage('');
                        setError('');
                      }}
                    >
                      {mode === 'remote' ? <Cloud size={21} /> : <Database size={21} />}
                      <span>
                        <strong>{mode === 'remote' ? 'Shared Server' : 'This Browser'}</strong>
                        <small>
                          {mode === 'remote'
                            ? 'Individual server accounts'
                            : 'Encrypted local storage'}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
                {!configuration.remoteEnabled && (
                  <p className="field-hint">
                    The workspace API is disabled. Browser workspace creation is available; enable
                    the API on the server for shared storage.
                  </p>
                )}
                {storage === 'local' && exists ? (
                  <div className="master-existing">
                    <CheckCircle2 size={26} />
                    <h3>A Workspace Already Exists In This Browser</h3>
                    <p>
                      Sign in with its administrator account to update its company details and
                      branding.
                    </p>
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy}
                      onClick={goToWorkspace}
                    >
                      Go To Workspace Login
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="master-section-heading">Business Details</h3>
                    <Field label="Business Name">
                      <input
                        value={company.name}
                        onChange={(e) => setCompany({ ...company, name: e.target.value })}
                        maxLength={150}
                        autoComplete="organization"
                        required
                      />
                    </Field>
                    <Field label="Company Address">
                      <input
                        value={company.address}
                        onChange={(e) => setCompany({ ...company, address: e.target.value })}
                        maxLength={1000}
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Company Phone">
                        <input
                          value={company.phone}
                          onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                          maxLength={100}
                        />
                      </Field>
                      <Field label="Company Email">
                        <input
                          type="email"
                          value={company.email}
                          onChange={(e) => setCompany({ ...company, email: e.target.value })}
                          maxLength={254}
                        />
                      </Field>
                      <Field label="VAT / PAN">
                        <input
                          value={company.pan}
                          onChange={(e) => setCompany({ ...company, pan: e.target.value })}
                          maxLength={100}
                        />
                      </Field>
                      <Field label="Quotation Prefix" hint="For example: ANV/83-84/001">
                        <input
                          value={prefix}
                          onChange={(e) => setPrefix(e.target.value)}
                          maxLength={12}
                        />
                      </Field>
                    </div>
                    {needsAdmin && (
                      <>
                        <h3 className="master-section-heading">Workspace Super Admin</h3>
                        <p className="field-hint">
                          A separate account for managing your team, quotations and CRM.
                        </p>
                        <Field label="Administrator Name">
                          <input
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            maxLength={100}
                            autoComplete="name"
                          />
                        </Field>
                        <Field label="Email Address">
                          <input
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            autoComplete="username"
                            maxLength={254}
                            required
                          />
                        </Field>
                        <div className="form-grid">
                          <Field label="Password" hint="At least 12 characters.">
                            <input
                              type="password"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              autoComplete="new-password"
                              maxLength={256}
                              required
                            />
                          </Field>
                          <Field label="Confirm Password">
                            <input
                              type="password"
                              value={confirm}
                              onChange={(e) => setConfirm(e.target.value)}
                              autoComplete="new-password"
                              maxLength={256}
                              required
                            />
                          </Field>
                        </div>
                      </>
                    )}
                    {!needsAdmin && !configured && (
                      <p className="info-note">
                        Existing server accounts will retain access to this workspace.
                      </p>
                    )}
                    {!configured && (
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={sample}
                          onChange={(e) => setSample(e.target.checked)}
                        />
                        <span>Include Fictional Sample Customers And Quotations</span>
                      </label>
                    )}
                    <ErrorText>{error}</ErrorText>
                    {message && (
                      <p className="master-success" role="status">
                        <CheckCircle2 size={18} />
                        {message}
                      </p>
                    )}
                    <div className="master-form-actions">
                      <button className="button primary" disabled={busy}>
                        {busy ? <Spinner /> : <Building2 size={17} />}
                        {configured ? 'Save Configuration' : 'Create Workspace'}
                      </button>
                      {configured && (
                        <button
                          type="button"
                          className="button"
                          disabled={busy}
                          onClick={goToWorkspace}
                        >
                          Go To Workspace Login
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </form>
            )}
          </section>
        </div>
        <OwnerBrandSettings onPreview={setBrandPreview} />
        <OwnerAccounts
          revision={configuration?.revision}
          ownerEmail={session.email}
          onOwnerMfaReset={(next) => {
            setSession(next);
            setSecurity(false);
            setSecurityDirty(false);
            setConfiguration(undefined);
            setChallenge(undefined);
            setCode('');
            setPassword('');
            setError('');
            setMessage('');
          }}
        />
        <OwnerConnections connection={{ mode: 'remote', url, token: '' }} />
        <footer className="master-console-footer">#ForgingITExcellence</footer>
      </div>
      {profileOpen && <OwnerProfile email={session.email} onClose={() => setProfileOpen(false)} />}
      {security && (
        <OwnerSettings
          required={session.twoFactorRequired}
          onClose={() => {
            if (
              !securityDirty ||
              window.confirm('Close security settings? Save any recovery codes before leaving.')
            )
              setSecurity(false);
          }}
          onPassword={() => {
            if (
              securityDirty &&
              !window.confirm('Leave security settings? Save any recovery codes before leaving.')
            )
              return;
            setSecurity(false);
            setSecurityDirty(false);
            setPassword('');
            setChangingPassword(true);
          }}
          onDirty={setSecurityDirty}
          onReset={() => {
            setSession(restoreMasterSession());
            setSecurity(false);
            setSecurityDirty(false);
            setConfiguration(undefined);
          }}
        />
      )}
    </main>
  );
}
