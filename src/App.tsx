import {
  currentUrl,
  routeFor,
  loginUrl,
  postLoginUrl,
  navigateUrl,
  useAppLocation,
  canOpenPage,
  type Page,
} from './lib/routing';
import { CompanySwitcher } from './components/CompanySwitcher';
import { PortalArtwork } from './components/PortalArtwork';
import { ThemeToggle } from './components/ThemeControl';
import { StartupBrand } from './components/StartupBrand';
import { usePageTitle } from './lib/pageTitle';
import { watchInstallationBrand, syncInstallationBrand } from './lib/installationBrand';
import { AccountMenu } from './components/AccountMenu';
import { NavigationBrand } from './components/NavigationBrand';
import { DefaultBccSettings } from './components/DefaultBccSettings';
import { EmailHistory } from './components/EmailHistory';
import { WelcomeNotice } from './components/WelcomeNotice';
import { ANVIL_ACCENT } from './lib/theme';
import { readUiState, writeUiState, setUiScope, clearUiState } from './lib/uiState';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  LayoutDashboard,
  Building2,
  ChevronRight,
  FileText,
  Package,
  BriefcaseBusiness,
  Shield,
  Menu,
  Mail,
  Users,
  X,
} from 'lucide-react';
import {
  changePassword,
  hasAccount,
  lock,
  persistVault,
  manageLocalUsers,
  localAccountLocks,
  restoreLocalSession,
  touchLocalSession,
  AUTH_TAB_ID,
} from './lib/auth';
import { WorkspaceApi, CompanyAccessError } from './lib/api';
import {
  signOutServer,
  getServerSession,
  changeServerPassword,
  resumeServerSession,
  savedServer,
} from './lib/session';
import { workspaceSchema } from './domain/schema';
import type { AdminSettings, Connection, VaultData, Workspace, UserAction } from './domain/types';
import { Login } from './pages/Login';
import { Quotations } from './pages/Quotations';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { AccountSettings } from './pages/AccountSettings';
import { Customers } from './pages/Customers';
import { Editor } from './pages/Editor';
import { CompanySettings } from './pages/Settings';
import { CRM } from './pages/CRM';
import { AdminUsers, Products } from './pages/BusinessModules';
import { ErrorText, Mark, Modal, Spinner, Toast } from './components/ui';
import { applyFavicon } from './lib/brandAssets';
const labels: Record<Page, string> = {
  dashboard: 'Dashboard',
  quotations: 'Quotations',
  customers: 'Customers',
  products: 'Products & Inventory',
  crm: 'CRM Pipeline',
  company: 'Customization',
  users: 'Users & Roles',
  'email-history': 'Email History',
  editor: 'Quotation Workspace',
  profile: 'My Profile',
  settings: 'Settings',
};
export default function App() {
  const [restoring, setRestoring] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [brandPreview, setBrandPreview] = useState<AdminSettings | null>(null);
  const routeUrl = useAppLocation((action) => navigate(action));
  const route = routeFor(routeUrl);
  const page = route.page || 'dashboard';
  const setPage = (next: Page) => navigateUrl(`/${next}`);
  const editorParams = new URL(routeUrl, location.origin).searchParams;
  const initialQuote =
    page === 'editor'
      ? workspace?.quotations.find((q) => q.id === editorParams.get('quote'))
      : undefined;
  const quotationCustomer =
    page === 'editor'
      ? workspace?.customers.find((c) => c.id === editorParams.get('customer'))
      : undefined;
  const [editorKey, setEditorKey] = useState(0);
  const [toast, setToast] = useState('');
  const [welcome, setWelcome] = useState<{ name: string; id: number } | null>(null);
  const [fatal, setFatal] = useState('');
  const [remoteError, setRemoteError] = useState('');
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [accountMenu, setAccountMenu] = useState<'header' | 'sidebar' | null>(null);
  const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const visibleBrand =
    page === 'company' && vault && brandPreview ? brandPreview : workspace?.settings;
  const api = useRef<WorkspaceApi | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const session = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (page !== 'email-history' || !vault || !workspace) return;
    const user =
      workspace.users.find((user) => user.email === vault.email) ||
      vault.workspace.users.find((user) => user.email === vault.email);
    if (user?.role !== 'super_admin') setPage('dashboard');
  }, [page, vault, workspace]);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const hasLocalAccount = await hasAccount();
        if (cancelled) return;
        setExists(hasLocalAccount);
        const initialRoute = routeFor(currentUrl());
        if (!initialRoute.known || initialRoute.path === '/owner') return;
        const savedMode = sessionStorage.getItem('patra-workspace-session');
        if (savedMode === 'local') {
          const local = await restoreLocalSession();
          if (local?.mustChangePassword) {
            lock();
            return;
          }
          if (!cancelled && local) await login(local, undefined, true);
          return;
        }
        const saved = savedServer();
        const configuredUrl = import.meta.env.VITE_API_URL?.trim();
        if (
          savedMode === 'remote' ||
          configuredUrl ||
          saved?.mode === 'remote' ||
          !hasLocalAccount
        ) {
          const server = {
            url: configuredUrl || saved?.url || `${location.origin}/api`,
            mode: 'remote' as const,
          };
          const serverSession = await resumeServerSession(server.url);
          if (
            !serverSession ||
            serverSession.mustSetupTwoFactor ||
            serverSession.mustChangePassword
          )
            return;
          const connection: Connection = { mode: 'remote', url: server.url, token: '' };
          const client = new WorkspaceApi(connection);
          const remote = await client.load();
          if (!remote) throw new Error('The remote workspace is empty.');
          if (!cancelled)
            await login(
              { email: serverSession.user.email, workspace: remote, connection },
              client,
              true,
            );
        }
      } catch (error) {
        if (!cancelled) {
          setFatal((error as Error).message);
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);
  const logout = useCallback(() => {
    session.current++;
    clearUiState();
    signOutServer();
    setAccountMenu(null);
    setCompanySwitcherOpen(false);
    lock();
    setVault(null);
    setWorkspace(null);
    api.current = null;
    dirty.current = false;
    if (routeFor(currentUrl()).path !== '/owner') navigateUrl(loginUrl(currentUrl()), true);
    void hasAccount().then(setExists);
    setRemoteError('');
    setToast('');
    setWelcome(null);
  }, []);
  useEffect(() => {
    const endSession = () => {
      logout();
    };
    window.addEventListener('patra-session-expired', endSession);
    const channel = new BroadcastChannel('patra-access');
    channel.onmessage = (event) => {
      if (event.data?.type === 'login-blocked') {
        if (vault?.connection.mode === 'local' && vault.email === event.data.email) endSession();
        return;
      }
      if (event.data?.source !== AUTH_TAB_ID) endSession();
    };
    return () => {
      window.removeEventListener('patra-session-expired', endSession);
      channel.close();
    };
  }, [logout, vault?.email, vault?.connection.mode]);
  useEffect(() => {
    if (!vault) return;
    let timer: ReturnType<typeof setTimeout>;
    const savedSignIn =
      vault.connection.mode === 'remote' &&
      !!getServerSession(vault.connection.url)?.persistentExpiresAt;
    const reset = () => {
      if (vault.connection.mode === 'local') touchLocalSession();
      clearTimeout(timer);
      // Saved server sessions use the backend's fixed expiry and revocation policy.
      // An idle/background tab must not silently revoke the seven-day cookie.
      if (!savedSignIn) timer = setTimeout(logout, 30 * 60 * 1000);
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    reset();
    for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, reset);
    window.addEventListener('beforeunload', unload);
    return () => {
      clearTimeout(timer);
      for (const event of ['pointerdown', 'keydown']) window.removeEventListener(event, reset);
      window.removeEventListener('beforeunload', unload);
    };
  }, [!!vault, logout]);
  useEffect(() => {
    applyFavicon(
      visibleBrand?.favicon,
      visibleBrand?.brand,
      !!(page === 'company' && brandPreview),
    );
  }, [visibleBrand?.favicon, visibleBrand?.brand, page, !!brandPreview]);
  useEffect(
    () =>
      watchInstallationBrand(
        vault?.connection.url ||
          import.meta.env.VITE_API_URL ||
          savedServer()?.url ||
          location.origin + '/api',
      ),
    [vault?.connection.url],
  );
  function branding(w: Workspace) {
    try {
      localStorage.setItem(
        'patra-branding',
        JSON.stringify({
          name: w.company.name,
          logo: w.company.logo,
          accent: w.company.accent,
          appLogo: w.settings.appLogo || '',
          favicon: w.settings.favicon || '',
          appearance: w.settings.brand,
          loginLogoWidth: w.settings.loginLogoWidth || 150,
          loginBackground: w.settings.loginBackground || '',
          loginBackgroundColor: w.settings.loginBackgroundColor || '#174A78',
        }),
      );
    } catch {
      /* Non-critical public preview. */
    }
  }
  async function login(data: VaultData, restoredClient?: WorkspaceApi, restoringSession = false) {
    const active = ++session.current;
    setUiScope(
      `${data.connection.mode}:${data.connection.url}:${data.email}${data.connection.workspaceId && data.connection.workspaceId !== 'primary' ? ':' + data.connection.workspaceId : ''}`,
    );
    const selection = readUiState<{
      page: Page;
      quote?: string;
      customer?: string;
      editorKey?: number;
    }>('navigation', { page: 'dashboard' });
    const admin = data.workspace.users.find((u) => u.email === data.email)?.role === 'super_admin';
    const destination = postLoginUrl(currentUrl(), admin);
    const editing = routeFor(destination).page === 'editor';
    setEditorKey(restoringSession && editing ? selection.editorKey || 0 : 0);
    navigateUrl(destination, true);
    try {
      sessionStorage.setItem('patra-workspace-session', data.connection.mode);
    } catch {
      /* Keep the current in-memory session if storage is disabled. */
    }
    setVault(data);
    setWorkspace(data.workspace);
    setExists(true);
    setRemoteError('');
    if (data.connection.mode === 'remote') {
      if (restoredClient) {
        api.current = restoredClient;
        restoredClient.rememberCompany();
        branding(data.workspace);
        return;
      }
      setLoadingRemote(true);
      try {
        const client = new WorkspaceApi(data.connection);
        const remote = await client.load();
        if (!remote) throw new Error('The remote workspace is empty. Reconnect to initialize it.');
        if (session.current !== active) return;
        api.current = client;
        client.rememberCompany();
        setWorkspace(remote);
        branding(remote);
      } catch (e) {
        if (session.current === active) {
          setRemoteError((e as Error).message);
          setPage('dashboard');
        }
        return;
      } finally {
        if (session.current === active) setLoadingRemote(false);
      }
    }
    if (!restoringSession && session.current === active)
      setWelcome({
        name:
          data.workspace.users.find((user) => user.email === data.email)?.name ||
          data.email.split('@')[0],
        id: active,
      });
  }
  async function saveWorkspace(next: Workspace) {
    if (!vault || saving.current) throw new Error('Please wait for the current save to finish.');
    workspaceSchema.parse(next);
    saving.current = true;
    const active = session.current;
    try {
      if (vault.connection.mode === 'remote') {
        if (!api.current) throw new Error('Reconnect to your API before editing.');
        next = await api.current.save(next);
        void syncInstallationBrand();
      } else {
        const nextVault = { ...vault, workspace: next };
        await persistVault(nextVault);
        if (active === session.current) setVault(nextVault);
      }
      if (active === session.current) {
        setWorkspace(next);
        branding(next);
      }
    } finally {
      saving.current = false;
    }
  }
  async function manageUsers(action: UserAction) {
    if (!vault || !workspace || saving.current)
      throw new Error('Please wait for the current save to finish.');
    const active = session.current;
    saving.current = true;
    try {
      if (vault.connection.mode === 'remote') {
        if (!api.current) throw new Error('Reconnect to the server first.');
        const next = await api.current.manageUsers(action);
        if (active === session.current) setWorkspace(next.workspace);
        return next.temporaryPassword;
      } else {
        const { temporaryPassword, ...next } = await manageLocalUsers(
          { ...vault, workspace },
          action,
        );
        if (active === session.current) {
          setVault(next);
          setWorkspace(next.workspace);
        }
        return temporaryPassword;
      }
    } finally {
      saving.current = false;
    }
  }
  const readAccountLocks = useCallback(async () => {
    if (!vault || !workspace) throw new Error('Sign in again.');
    if (vault.connection.mode === 'remote') {
      if (!api.current) throw new Error('Reconnect to the server.');
      return api.current.accountLocks();
    }
    const locks = await localAccountLocks({ ...vault, workspace });
    return Object.fromEntries(
      Object.entries(locks).map(([id, lockedUntil]) => [
        id,
        { lockedUntil, manual: false, ownerLocked: false },
      ]),
    );
  }, [vault, workspace]);
  function navigate(action: () => void) {
    if (saving.current) {
      notify('Please wait for the save to finish');
      return;
    }
    if (dirty.current) setPending(() => action);
    else action();
  }
  function openCompanySwitcher() {
    setAccountMenu(null);
    setSidebar(false);
    setCompanySwitcherOpen(true);
  }
  async function switchCompany(id: string) {
    if (!vault || id === vault.connection.workspaceId) return;
    setLoadingRemote(true);
    setRemoteError('');
    const active = session.current;
    try {
      const connection = { ...vault.connection, workspaceId: id };
      const client = new WorkspaceApi(connection);
      const remote = await client.load();
      if (!remote) throw new Error('This company workspace is unavailable.');
      if (active !== session.current) return;
      dirty.current = false;
      setBrandPreview(null);
      setAccountMenu(null);
      await login({ ...vault, connection, workspace: remote }, client, true);
      notify(`Switched to ${remote.company.name}`);
    } catch (error) {
      if (active === session.current) notify((error as Error).message);
    } finally {
      setLoadingRemote(false);
    }
  }
  function pageLink(next: Page) {
    return {
      href: `/${next}`,
      'aria-disabled': remoteBlocked || undefined,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (remoteBlocked) {
          event.preventDefault();
          return;
        }
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        go(next);
      },
    };
  }
  function go(next: Page) {
    if (
      !isAdmin &&
      ![
        'dashboard',
        'quotations',
        'crm',
        'editor',
        'products',
        'customers',
        'profile',
        'settings',
      ].includes(next)
    ) {
      notify('This area is available to administrators only');
      return;
    }
    navigate(() => {
      setPage(next);
      setAccountMenu(null);
      setSidebar(false);
    });
  }
  useEffect(() => {
    if (vault)
      writeUiState('navigation', {
        page,
        quote: initialQuote?.id,
        customer: quotationCustomer?.id,
        editorKey,
      });
  }, [vault, page, initialQuote?.id, quotationCustomer?.id, editorKey]);
  useEffect(() => {
    if (vault?.connection.mode !== 'remote') return;
    const controller = new AbortController();
    const active = session.current;
    let pendingUpdate = false;
    let changeVersion = 0;
    let refreshing = false;
    const refresh = async () => {
      if (!pendingUpdate || refreshing || dirty.current || saving.current || !api.current) return;
      refreshing = true;
      const requestedVersion = changeVersion;
      try {
        const next = await api.current.load(
          () =>
            !dirty.current &&
            !saving.current &&
            active === session.current &&
            !controller.signal.aborted,
        );
        if (next && active === session.current && !controller.signal.aborted) {
          setWorkspace(next);
          branding(next);
          pendingUpdate = requestedVersion !== changeVersion;
        }
      } catch (error) {
        if (error instanceof CompanyAccessError && active === session.current) {
          api.current = null;
          setRemoteError(error.message);
          dirty.current = false;
          setPage('dashboard');
        }
        /* The stream reconnects when the backend becomes available. */
      } finally {
        refreshing = false;
      }
    };
    const client = api.current;
    void client?.watch(
      () => {
        changeVersion++;
        pendingUpdate = true;
        void refresh();
      },
      controller.signal,
      (message) => {
        if (active !== session.current || controller.signal.aborted) return;
        api.current = null;
        dirty.current = false;
        clearUiState();
        setPage('dashboard');
        setRemoteError(message);
      },
    );
    const timer = setInterval(() => {
      void refresh();
    }, 1000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [
    vault?.email,
    vault?.connection.mode,
    vault?.connection.url,
    vault?.connection.workspaceId,
    loadingRemote,
  ]);
  useEffect(() => {
    if (restoring || exists === null || fatal || !route.known || route.path === '/owner') return;
    if (!vault || !workspace) {
      if (route.path !== '/login') navigateUrl(loginUrl(routeUrl), true);
      return;
    }
    const admin =
      (
        workspace.users.find((user) => user.email === vault.email) ||
        vault.workspace.users.find((user) => user.email === vault.email)
      )?.role === 'super_admin';
    if (!route.page || !canOpenPage(route.page, admin))
      navigateUrl(postLoginUrl(routeUrl, admin), true);
  }, [restoring, exists, fatal, routeUrl, vault, workspace]);
  const closePending = useCallback(() => setPending(null), []);
  usePageTitle(
    !route.known
      ? 'Page Not Found'
      : fatal
        ? 'Connection Error'
        : restoring || exists === null
          ? 'Opening Workspace'
          : vault && workspace
            ? page === 'editor'
              ? initialQuote
                ? 'Edit Quotation'
                : 'New Quotation'
              : labels[page]
            : undefined,
  );
  if (!route.known)
    return (
      <main className="page-not-found">
        <div className="page-not-found-card">
          <Mark />
          <span className="eyebrow">404 · PAGE NOT FOUND</span>
          <h1>We Couldn’t Find That Page</h1>
          <p>Check the address for a typo, or return to the sign-in page.</p>
          <a className="button primary" href="/login">
            <ArrowRight size={16} />
            Return to sign in
          </a>
        </div>
      </main>
    );
  if (fatal)
    return (
      <div className="startup">
        <StartupBrand />
        <h1>Storage Needs Your Attention</h1>
        <ErrorText>{fatal}</ErrorText>
        <button className="button" onClick={() => location.reload()}>
          Try Again
        </button>
      </div>
    );
  if (exists === null || restoring)
    return (
      <div className="startup" role="status" aria-live="polite" aria-busy="true">
        <StartupBrand />
        <Spinner />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!vault || !workspace || route.path === '/owner')
    return <Login exists={exists} onLogin={login} owner={route.path === '/owner'} />;
  const company = workspace.company;
  const currentUser = workspace.users.find((u) => u.email === vault.email) ||
    vault.workspace.users.find((u) => u.email === vault.email) || {
      id: 'owner',
      name: vault.email.split('@')[0],
      email: vault.email,
      role: 'user' as const,
      active: true,
      createdAt: '',
    };
  const isAdmin = currentUser.role === 'super_admin';
  const remoteBlocked = vault.connection.mode === 'remote' && !api.current;
  if (!canOpenPage(page, isAdmin))
    return (
      <div className="startup">
        <Spinner />
      </div>
    );
  return (
    <div
      className="app-shell"
      style={
        {
          '--accent': ANVIL_ACCENT,
          '--accent-ink': '#ffffff',
          '--accent-readable': ANVIL_ACCENT,
          '--nav-logo-size': `${visibleBrand?.appLogoSize || 32}px`,
          '--nav-text-size': `${visibleBrand?.appTextSize || 11}px`,
        } as React.CSSProperties
      }
    >
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="sidebar-brand brand-stacked">
          <NavigationBrand settings={visibleBrand || workspace.settings} />
          <button
            className="icon-button mobile-close"
            onClick={() => setSidebar(false)}
            aria-label="Close Navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <a {...pageLink('dashboard')} className={page === 'dashboard' ? 'active' : ''}>
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <a
            {...pageLink('quotations')}
            className={page === 'quotations' || page === 'editor' ? 'active' : ''}
          >
            <FileText size={18} />
            Quotations<span>{workspace.quotations.length}</span>
          </a>
          {isAdmin && (
            <a {...pageLink('email-history')} className={page === 'email-history' ? 'active' : ''}>
              <Mail size={18} />
              Email History
            </a>
          )}
          <a {...pageLink('crm')} className={page === 'crm' ? 'active' : ''}>
            <BriefcaseBusiness size={18} />
            CRM
            <span>{workspace.leads.filter((l) => !['Won', 'Lost'].includes(l.stage)).length}</span>
          </a>
          <a {...pageLink('products')} className={page === 'products' ? 'active' : ''}>
            <Package size={18} />
            Products<span>{workspace.products.length}</span>
          </a>
          <a {...pageLink('customers')} className={page === 'customers' ? 'active' : ''}>
            <Users size={18} />
            Customers
          </a>
        </nav>
        {isAdmin && (
          <>
            <div className="nav-label settings-label">ADMIN PORTAL</div>
            <nav>
              <a {...pageLink('company')} className={page === 'company' ? 'active' : ''}>
                <Building2 size={18} />
                Customization
              </a>

              <a {...pageLink('users')} className={page === 'users' ? 'active' : ''}>
                <Shield size={18} />
                Users & Roles<span>{workspace.users.length}</span>
              </a>
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <AccountMenu
              user={currentUser}
              placement="sidebar"
              open={accountMenu === 'sidebar'}
              onOpen={() => setAccountMenu('sidebar')}
              onClose={() => setAccountMenu(null)}
              onProfile={() => go('profile')}
              onSettings={() => go('settings')}
              onLogout={() => navigate(logout)}
              onSwitchWorkspace={
                vault.connection.mode === 'remote' ? openCompanySwitcher : undefined
              }
              workspaceSwitchDisabled={loadingRemote}
            />
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-overlay"
          onClick={() => setSidebar(false)}
          aria-label="Close Navigation"
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button menu-button"
              onClick={() => setSidebar(true)}
              aria-label="Open Navigation"
            >
              <Menu size={20} />
            </button>
            {isAdmin && (
              <>
                <span className="topbar-company">{company.name}</span>
                <ChevronRight size={13} />
              </>
            )}
            <strong>{labels[page]}</strong>
          </div>
          <div>
            <ThemeToggle />
            <AccountMenu
              user={currentUser}
              placement="header"
              open={accountMenu === 'header'}
              onOpen={() => setAccountMenu('header')}
              onClose={() => setAccountMenu(null)}
              onProfile={() => go('profile')}
              onSettings={() => go('settings')}
              onLogout={() => navigate(logout)}
              onSwitchWorkspace={
                vault.connection.mode === 'remote' ? openCompanySwitcher : undefined
              }
              workspaceSwitchDisabled={loadingRemote}
            />
            <span className="topbar-date">
              {new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Kathmandu',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date())}
            </span>
          </div>
        </header>
        <main
          key={`${vault.connection.workspaceId || 'primary'}:${page}`}
          className={`main-content ${page === 'editor' ? 'editor-content' : ''}`}
        >
          {page !== 'editor' && <PortalArtwork />}
          {loadingRemote ? (
            <div className="empty-state">
              <Spinner />
              <h2>Connecting To Your Workspace…</h2>
              <p>Checking credentials and loading remote records.</p>
            </div>
          ) : remoteBlocked && remoteError ? (
            <div className="empty-state">
              <Building2 size={28} />
              <h2>Company Access Unavailable</h2>
              <p>{remoteError}</p>
              <p>
                Open your profile menu and choose Switch Workspace to select another assigned
                company.
              </p>
            </div>
          ) : (
            <>
              {remoteError && (
                <div className="error-banner">
                  <ErrorText>{remoteError}</ErrorText>
                  <p>
                    Your remote data has not been replaced. Reconnect below or choose your separate
                    local workspace.
                  </p>
                </div>
              )}
              {page === 'dashboard' && (
                <Dashboard
                  workspace={workspace}
                  onNavigate={go}
                  onOpenQuote={(q) => {
                    setEditorKey((k) => k + 1);
                    navigateUrl(q ? `/editor?quote=${encodeURIComponent(q.id)}` : '/editor');
                  }}
                />
              )}
              {page === 'profile' && (
                <Profile
                  user={currentUser}
                  isRemote={vault.connection.mode === 'remote'}
                  onDirty={onDirty}
                  notify={notify}
                  onSave={async (details) => {
                    const updated = { ...currentUser, ...details };
                    await saveWorkspace({
                      ...workspace,
                      users: workspace.users.some((user) => user.id === currentUser.id)
                        ? workspace.users.map((user) =>
                            user.id === currentUser.id ? updated : user,
                          )
                        : [...workspace.users, updated],
                    });
                  }}
                  onSaveEmail={async (preferences) => {
                    await saveWorkspace({
                      ...workspace,
                      users: workspace.users.map((user) =>
                        user.id === currentUser.id ? { ...user, ...preferences } : user,
                      ),
                    });
                  }}
                />
              )}
              {page === 'settings' && (
                <AccountSettings
                  user={currentUser}
                  apiUrl={vault.connection.url}
                  isRemote={vault.connection.mode === 'remote'}
                  twoFactorRequired={
                    getServerSession(vault.connection.url)?.twoFactorRequired || false
                  }
                  onDirty={onDirty}
                  notify={notify}
                  onMfaReset={() => {
                    session.current++;
                    dirty.current = false;
                    api.current = null;
                    setVault(null);
                    setWorkspace(null);
                    setWelcome(null);
                    setPending(null);
                  }}
                  onPassword={async (current, next) => {
                    if (saving.current)
                      throw new Error('Please wait for the current save to finish.');
                    saving.current = true;
                    try {
                      if (vault.connection.mode === 'remote')
                        await changeServerPassword(vault.connection.url, current, next);
                      else await changePassword(vault.email, current, next);
                    } finally {
                      saving.current = false;
                    }
                  }}
                />
              )}
              {(page === 'quotations' || page === 'editor') && (
                <Quotations
                  workspace={workspace}
                  onDelete={(q) => {
                    if (!window.confirm(`Delete quotation ${q.number}? This cannot be undone.`))
                      return;
                    void saveWorkspace({
                      ...workspace,
                      quotations: workspace.quotations.filter((item) => item.id !== q.id),
                    })
                      .then(() => notify('Quotation deleted'))
                      .catch((e) => notify((e as Error).message));
                  }}
                  onOpen={(q) => {
                    setEditorKey((k) => k + 1);
                    navigateUrl(q ? `/editor?quote=${encodeURIComponent(q.id)}` : '/editor');
                  }}
                />
              )}{' '}
              {page === 'customers' && (
                <Customers
                  connection={vault.connection}
                  canViewEmailHistory={isAdmin}
                  workspace={workspace}
                  onSave={saveWorkspace}
                  notify={notify}
                />
              )}{' '}
              {page === 'products' && (
                <Products workspace={workspace} onSave={saveWorkspace} notify={notify} />
              )}{' '}
              {page === 'crm' && (
                <CRM
                  workspace={workspace}
                  currentUser={currentUser}
                  onSave={saveWorkspace}
                  notify={notify}
                  onDirty={onDirty}
                  onCreateQuotation={(customerId) => {
                    setEditorKey((key) => key + 1);
                    navigateUrl(`/editor?customer=${encodeURIComponent(customerId)}`);
                  }}
                />
              )}{' '}
              {page === 'editor' && (
                <Modal
                  title={initialQuote ? 'Edit Quotation' : 'New Quotation'}
                  subtitle={workspace.company.name}
                  className="quotation-editor-modal"
                  onClose={() => go('quotations')}
                >
                  <div className="quotation-editor-body">
                    <Editor
                      key={`${editorKey}:${initialQuote?.id || quotationCustomer?.id || 'new'}`}
                      draftKey={`${editorKey}:${initialQuote?.id || quotationCustomer?.id || 'new'}`}
                      workspace={workspace}
                      currentUser={currentUser}
                      initial={initialQuote}
                      initialCustomer={quotationCustomer}
                      connection={vault.connection}
                      onSave={saveWorkspace}
                      onBack={() => go('quotations')}
                      onDelete={async (quote) => {
                        await saveWorkspace({
                          ...workspace,
                          quotations: workspace.quotations.filter((item) => item.id !== quote.id),
                        });
                        dirty.current = false;
                        setPage('quotations');
                        notify('Quotation deleted');
                      }}
                      notify={notify}
                      onDirty={onDirty}
                    />
                  </div>
                </Modal>
              )}{' '}
              {page === 'company' && isAdmin && (
                <>
                  <CompanySettings
                    workspace={workspace}
                    onSave={saveWorkspace}
                    notify={notify}
                    onDirty={onDirty}
                    onPreview={setBrandPreview}
                  />
                  <DefaultBccSettings connection={vault.connection} />
                </>
              )}{' '}
              {page === 'users' && isAdmin && (
                <AdminUsers
                  workspace={workspace}
                  onAction={manageUsers}
                  onReadLocks={readAccountLocks}
                  currentEmail={vault.email}
                  isRemote={vault.connection.mode === 'remote'}
                  notify={notify}
                />
              )}{' '}
              {page === 'email-history' && isAdmin && (
                <EmailHistory connection={vault.connection} />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>Anvil Technologies Business Forge Platform</span>
          <span>#ForgingITExcellence</span>
        </footer>
      </div>
      {toast && <Toast message={toast} />}
      {welcome && <WelcomeNotice key={welcome.id} name={welcome.name} />}
      {companySwitcherOpen && vault.connection.mode === 'remote' && (
        <Modal title="Switch Workspace" onClose={() => setCompanySwitcherOpen(false)}>
          <div className="modal-body workspace-switch-dialog">
            <p className="muted">Only companies assigned to your account are shown.</p>
            <CompanySwitcher
              connection={vault.connection}
              disabled={loadingRemote}
              onSelect={(id) => {
                setCompanySwitcherOpen(false);
                navigate(() => {
                  void switchCompany(id);
                });
              }}
            />
          </div>
          <div className="modal-actions">
            <button className="button" onClick={() => setCompanySwitcherOpen(false)}>
              Close
            </button>
          </div>
        </Modal>
      )}
      {pending && (
        <Modal
          title="Leave Unsaved Changes?"
          subtitle="Your changes have not been saved to this workspace."
          onClose={closePending}
        >
          <div className="modal-body">
            <p>You can stay and save your work, or discard these edits and continue.</p>
          </div>
          <div className="modal-actions">
            <button className="button" onClick={closePending}>
              Keep Editing
            </button>
            <button
              className="button primary"
              onClick={() => {
                const action = pending;
                dirty.current = false;
                setPending(null);
                action();
              }}
            >
              Discard & Continue
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
