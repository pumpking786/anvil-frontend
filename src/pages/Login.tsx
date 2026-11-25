import { navigateUrl } from '../lib/routing';
import { RequiredPasswordChange } from '../components/RequiredPasswordChange';
import { changeServerPassword } from '../lib/session';
import { changePassword, lock } from '../lib/auth';
import { TwoFactorCode } from '../components/TwoFactorCode';
import { usePageTitle } from '../lib/pageTitle';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import {
  TwoFactorRequired,
  TwoFactorSetupRequired,
  type TwoFactorChallenge,
} from '../lib/twoFactor';
import { verifyServerTwoFactor, configurePersistentSignIn } from '../lib/session';
import { getServerSession } from '../lib/session';
import { LOGIN_POLICY_TEXT } from '../lib/loginPolicy';
import { LoginPresentation } from '../components/LoginPresentation';
import { savedServer, signInServer, rememberServer, signOutServer } from '../lib/session';
import { WorkspaceApi } from '../lib/api';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { publicBranding, signIn } from '../lib/auth';
import type { VaultData } from '../domain/types';
import { ErrorText, Field, Spinner } from '../components/ui';
import { applyFavicon } from '../lib/brandAssets';
import {
  useInstallationBrand,
  setFaviconSource,
  resolveLoginBrand,
} from '../lib/installationBrand';
import { MasterPortal } from './MasterPortal';
export function Login({
  exists,
  onLogin,
  owner = false,
}: {
  exists: boolean;
  owner?: boolean;
  onLogin: (data: VaultData) => Promise<void>;
}) {
  const loginPending = useRef(false);
  const savedLoginBrand = publicBranding();
  const installationBrand = useInstallationBrand();
  const [challenge, setChallenge] = useState<TwoFactorChallenge>();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const activeSession = () =>
    getServerSession(
      import.meta.env.VITE_API_URL?.trim() || savedServer()?.url || `${location.origin}/api`,
    );
  const [passwordRequired, setPasswordRequired] = useState(
    () => !!activeSession()?.mustChangePassword,
  );
  const [localPending, setLocalPending] = useState<VaultData>();
  const [setupRequired, setSetupRequired] = useState(() => !!activeSession()?.mustSetupTwoFactor);
  const master = owner;
  const [mode, setMode] = useState<'local' | 'remote'>(() =>
    import.meta.env.VITE_API_URL?.trim()
      ? 'remote'
      : savedServer()?.mode || (exists ? 'local' : 'remote'),
  );
  const [serverUrl, setServerUrl] = useState(
    () => import.meta.env.VITE_API_URL?.trim() || savedServer()?.url || `${location.origin}/api`,
  );
  useEffect(() => {
    setFaviconSource(serverUrl);
  }, [serverUrl]);
  const brand =
    mode === 'local' ? savedLoginBrand : resolveLoginBrand(installationBrand, savedLoginBrand);
  useEffect(
    () => applyFavicon(brand.favicon, brand.appearance),
    [brand.favicon, JSON.stringify(brand.appearance)],
  );
  const [email, setEmail] = useState(() => activeSession()?.user.email || '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageTitle(
    master
      ? undefined
      : passwordRequired
        ? 'Choose Your New Password'
        : setupRequired
          ? 'Set Up Two-Factor Authentication'
          : challenge
            ? 'Verify Your Identity'
            : 'Workspace Sign In',
  );
  if (master)
    return (
      <MasterPortal
        exists={exists}
        initialUrl={serverUrl}
        onBack={() => {
          navigateUrl('/login');
          const destination = savedServer();
          if (destination) {
            setServerUrl(import.meta.env.VITE_API_URL?.trim() || destination.url);
            setMode(import.meta.env.VITE_API_URL?.trim() ? 'remote' : destination.mode);
          }
          setPassword('');
          setError('');
        }}
        onLogin={onLogin}
      />
    );
  async function finishRemoteSignIn() {
    const session = getServerSession(serverUrl);
    if (session?.mustChangePassword) {
      setPasswordRequired(true);
      setChallenge(undefined);
      setPassword('');
      setCode('');
      return;
    }
    if (session?.mustSetupTwoFactor) {
      setSetupRequired(true);
      setChallenge(undefined);
      setPassword('');
      return;
    }
    await configurePersistentSignIn(serverUrl, keepSignedIn);
    const connection = { mode: 'remote' as const, url: serverUrl, token: '' };
    const workspace = await new WorkspaceApi(connection).load();
    if (!workspace)
      throw new Error(
        'The workspace is not configured yet. Ask your installation owner to finish the first-time setup at the private owner portal.',
      );
    rememberServer(serverUrl, 'remote');
    await onLogin({ email: email.trim().toLowerCase(), workspace, connection });
  }
  function cancelChallenge() {
    if (busy) return;
    setChallenge(undefined);
    setCode('');
    setRecovery(false);
    setRememberDevice(false);
    setError('');
    setPassword('');
  }
  function cancelEnrollment() {
    signOutServer();
    setSetupRequired(false);
    setError('');
  }
  if (passwordRequired)
    return (
      <LoginPresentation brand={brand}>
        <RequiredPasswordChange
          onCancel={() => {
            if (mode === 'remote') signOutServer();
            else lock();
            setPasswordRequired(false);
            setSetupRequired(false);
            setLocalPending(undefined);
            setPassword('');
            setError('');
          }}
          onChange={async (current, next) => {
            if (mode === 'remote') {
              await changeServerPassword(serverUrl, current, next);
              setPasswordRequired(false);
              await finishRemoteSignIn().catch((cause) => setError((cause as Error).message));
            } else if (localPending) {
              await changePassword(localPending.email, current, next);
              await onLogin({ ...localPending, mustChangePassword: false });
              setLocalPending(undefined);
              setPasswordRequired(false);
            }
          }}
        />
        <ErrorText>{error}</ErrorText>
      </LoginPresentation>
    );
  if (setupRequired)
    return (
      <LoginPresentation
        brand={brand}
        dialog={{ title: 'Secure Your Account', enrollment: true, onClose: cancelEnrollment }}
      >
        <TwoFactorSettings
          apiUrl={serverUrl}
          required
          compact
          onRequiredComplete={() => {
            setSetupRequired(false);
            void finishRemoteSignIn().catch((cause) => setError((cause as Error).message));
          }}
        />
        <ErrorText>{error}</ErrorText>
      </LoginPresentation>
    );
  return (
    <LoginPresentation
      brand={brand}
      dialog={challenge ? { title: 'Verify Your Identity', onClose: cancelChallenge } : undefined}
    >
      {!challenge && <h2>{brand.appearance?.loginHeading ?? 'Welcome Back'}</h2>}
      <p className="login-description">
        {challenge
          ? 'Enter your authenticator code to finish signing in. This step expires in 5 minutes.'
          : (brand.appearance?.loginMessage ?? 'Sign in to your workspace.')}
      </p>
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (loginPending.current) return;
          setError('');
          if (!challenge && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError('Enter a valid email address.');
            return;
          }
          if (!challenge && !password) {
            setError('Enter your password.');
            return;
          }
          loginPending.current = true;
          setBusy(true);
          try {
            if (mode === 'remote') {
              if (challenge)
                await verifyServerTwoFactor(
                  serverUrl,
                  challenge.challengeToken,
                  code,
                  recovery,
                  rememberDevice,
                );
              else await signInServer(serverUrl, email, password);
              await finishRemoteSignIn();
            } else {
              if (!exists)
                throw new Error(
                  'No workspace is configured in this browser. Ask your installation owner to finish the first-time setup.',
                );
              const data = await signIn(email, password);
              data.connection.mode = 'local';
              data.connection.token = '';
              if (data.mustChangePassword) {
                setLocalPending(data);
                setPasswordRequired(true);
                setPassword('');
              } else await onLogin(data);
            }
          } catch (err) {
            if (err instanceof TwoFactorRequired) {
              setChallenge(err.challenge);
              setPassword('');
              setCode('');
              return;
            }
            if (err instanceof TwoFactorSetupRequired) {
              setSetupRequired(true);
              setPassword('');
              setError('');
              return;
            }
            if (mode === 'remote' && !challenge) signOutServer();
            setError((err as Error).message);
          } finally {
            loginPending.current = false;
            setBusy(false);
          }
        }}
      >
        {!challenge && (
          <>
            <Field label="Email Address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                required
                autoFocus
              />
            </Field>
            <Field label="Password">
              <span className="password-input">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={show ? 'Hide Password' : 'Show Password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </Field>
          </>
        )}
        {mode === 'remote' && !challenge && (
          <label className="checkbox-line keep-signed-in">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              disabled={busy}
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
        <ErrorText>{error}</ErrorText>
        <button className="button primary login-submit" disabled={busy}>
          {busy && <Spinner />}
          {challenge ? 'Verify & Sign In' : 'Sign In To Workspace'}
          <ArrowRight size={17} />
        </button>
      </form>
      {challenge && (
        <button
          type="button"
          className="button ghost two-factor-back"
          disabled={busy}
          onClick={cancelChallenge}
        >
          Back To Password
        </button>
      )}
      {!challenge && (
        <div className="login-security-footer">
          <div className="login-security">
            <ShieldCheck size={18} />
            <span>
              {mode === 'remote'
                ? 'Secure server sign-in'
                : 'Your local business data is encrypted'}
            </span>
          </div>
          <details className="login-policy-details">
            <summary>Account Security</summary>
            <p>{LOGIN_POLICY_TEXT}</p>
          </details>
        </div>
      )}
    </LoginPresentation>
  );
}
