import { authRequest, savedServer } from './session';
import { masterRequest } from './master';
import type { Branding, VaultData, UserAction } from '../domain/types';
import {
  readVault,
  writeVault,
  checkLocalLogin,
  localLoginState,
  updateLocalLogin,
  type SealedVault,
} from './storage';
export const AUTH_TAB_ID = crypto.randomUUID();
let key: Promise<CryptoKey> | null = null;
let rawKey: Uint8Array<ArrayBuffer> | null = null;
let accounts: NonNullable<SealedVault['accounts']> = [];
let revision = 0;
let queue: Promise<void> = Promise.resolve();
const encoder = new TextEncoder();
async function derive(password: string, value: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: value, iterations: 600_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
const randomBytes = (size: number) =>
  crypto.getRandomValues(new Uint8Array(size)) as Uint8Array<ArrayBuffer>;
async function createAccountKey(email: string, password: string, raw: Uint8Array<ArrayBuffer>) {
  const salt = randomBytes(16);
  const wrapping = await derive(password, salt);
  const wrapIv = randomBytes(12);
  const wrappedKey = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, wrapping, raw);
  return { email: email.trim().toLowerCase(), salt, wrapIv, wrappedKey };
}
function seal(
  data: VaultData,
  activeKey: CryptoKey,
  allAccounts: NonNullable<SealedVault['accounts']>,
  rev: number,
): Promise<SealedVault> {
  const iv = randomBytes(12);
  return crypto.subtle
    .encrypt({ name: 'AES-GCM', iv }, activeKey, encoder.encode(JSON.stringify(data)))
    .then((ciphertext) => ({ version: 2, iv, ciphertext, revision: rev, accounts: allAccounts }));
}
const LOCAL_SESSION_KEY = 'patra-local-session';
const ACTIVE_SESSION_KEY = 'patra-workspace-session';
const LOCAL_IDLE_LIMIT = 30 * 60 * 1000;
function saveLocalSession(
  email: string,
  dataKey: Uint8Array<ArrayBuffer>,
  lastActivity = Date.now(),
) {
  try {
    const rawKey = btoa(Array.from(dataKey, (byte) => String.fromCharCode(byte)).join(''));
    sessionStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ email, rawKey, lastActivity }));
    sessionStorage.setItem(ACTIVE_SESSION_KEY, 'local');
  } catch {
    // The encrypted workspace remains usable for the current page session.
  }
}
function activate(
  dataKey: Uint8Array<ArrayBuffer>,
  allAccounts: NonNullable<SealedVault['accounts']>,
  rev: number,
  email?: string,
) {
  rawKey = dataKey;
  key = crypto.subtle.importKey('raw', dataKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  accounts = allAccounts;
  revision = rev;
  if (email) saveLocalSession(email, dataKey);
}
export const hasAccount = async () => Boolean(await readVault());
export function publicBranding(): Branding {
  try {
    return (
      JSON.parse(localStorage.getItem('patra-branding') || 'null') || {
        name: 'Anvil Technologies Business Forge Platform',
        logo: '',
        accent: '#174A78',
        appLogo: '',
        favicon: '',
        loginLogoWidth: 150,
        loginBackground: '',
        loginBackgroundColor: '#174A78',
      }
    );
  } catch {
    return {
      name: 'Anvil Technologies Business Forge Platform',
      logo: '',
      accent: '#174A78',
      appLogo: '',
      favicon: '',
      loginLogoWidth: 150,
      loginBackground: '',
      loginBackgroundColor: '#174A78',
    };
  }
}
export async function createAccount(email: string, password: string, data: VaultData) {
  await masterRequest('/authorize', { email });
  if (await hasAccount())
    throw new Error('A workspace already exists in this browser. Sign in to continue.');
  const normalized = email.trim().toLowerCase();
  data.email = normalized;
  if (!data.workspace.users.length)
    data.workspace.users.push({
      id: crypto.randomUUID(),
      name: normalized.split('@')[0],
      email: normalized,
      role: 'super_admin',
      active: true,
      createdAt: new Date().toISOString(),
    });
  const dataKey = randomBytes(32);
  const account = await createAccountKey(normalized, password, dataKey);
  const activeKey = await crypto.subtle.importKey('raw', dataKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  const vault = await seal(data, activeKey, [account], 1);
  await writeVault(vault, 0);
  activate(dataKey, [account], 1, normalized);
  await setBranding(data);
}
async function setBranding(data: VaultData) {
  try {
    localStorage.setItem(
      'patra-branding',
      JSON.stringify({
        name: data.workspace.company.name,
        logo: data.workspace.company.logo,
        accent: data.workspace.company.accent,
        appLogo: data.workspace.settings.appLogo || '',
        favicon: data.workspace.settings.favicon || '',
        appearance: data.workspace.settings.brand,
        loginLogoWidth: data.workspace.settings.loginLogoWidth || 150,
        loginBackground: data.workspace.settings.loginBackground || '',
        loginBackgroundColor: data.workspace.settings.loginBackgroundColor || '#174A78',
      }),
    );
  } catch {
    /* The encrypted vault remains committed. */
  }
}
export async function signIn(email: string, password: string): Promise<VaultData> {
  const vault = await readVault();
  if (!vault) throw new Error('No local workspace found.');
  const normalized = email.trim().toLowerCase();
  await checkLocalLogin(normalized);
  let data: VaultData;
  let unlockedKey: Uint8Array<ArrayBuffer>;
  let allAccounts: NonNullable<SealedVault['accounts']>;
  if (vault.version === 1) {
    if (!vault.salt) throw new Error('This workspace needs to be restored from a backup.');
    const candidate = await derive(password, vault.salt);
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: vault.iv },
        candidate,
        vault.ciphertext,
      );
      data = JSON.parse(new TextDecoder().decode(plain));
      if (data.email !== normalized) throw new Error();
    } catch {
      await updateLocalLogin(normalized, 'failure', vault.revision);
      throw new Error('Email or password is incorrect. Please try again.');
    }
    unlockedKey = randomBytes(32);
    allAccounts = [await createAccountKey(normalized, password, unlockedKey)];
    const upgradedKey = await crypto.subtle.importKey(
      'raw',
      unlockedKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
    const upgraded = await seal(data, upgradedKey, allAccounts, vault.revision + 1);
    await writeVault(upgraded, vault.revision, normalized);
    vault.revision++;
    if (!data.workspace.users?.length)
      data.workspace.users = [
        {
          id: crypto.randomUUID(),
          name: normalized.split('@')[0],
          email: normalized,
          role: 'super_admin',
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
    if (!data.workspace.products) data.workspace.products = [];
    if (!data.workspace.leads) data.workspace.leads = [];
    if (!data.workspace.settings)
      data.workspace.settings = {
        quotePrefix: 'ANV',
        validityDays: 30,
        defaultVat: true,
        defaultDesign: 'classic',
        lowStockThreshold: 5,
        defaultLogoWidth: 132,
        appLogo: '',
        favicon: '',
        loginLogoWidth: 150,
        loginBackground: '',
        loginBackgroundColor: '#174A78',
        fiscalYearOverride: '',
        fiscalYearOverrideFor: '',
      };
    data.workspace.sequenceYear ||= '';
    data.workspace.settings.defaultLogoWidth ||= 132;
    if (data.workspace.settings.quotePrefix === 'QT') data.workspace.settings.quotePrefix = 'ANV';
    data.workspace.settings.appLogo ||= '';
    data.workspace.settings.favicon ||= '';
    data.workspace.settings.loginLogoWidth ||= 150;
    data.workspace.settings.loginBackground ||= '';
    data.workspace.settings.loginBackgroundColor ||= '#174A78';
    data.workspace.settings.fiscalYearOverride ||= '';
    data.workspace.settings.fiscalYearOverrideFor ||= '';
    // The migration also saves the expanded domain model under the new data key.
    data.workspace.quotations = data.workspace.quotations.map((q) => ({
      ...q,
      status: q.status || 'Valid',
      layout: q.layout || { design: 'classic', logoWidth: 132 },
    }));
  } else {
    const account = vault.accounts?.find((a) => a.email === normalized);
    if (!account) throw new Error('Email or password is incorrect. Please try again.');
    try {
      const wrapping = await derive(password, account.salt);
      unlockedKey = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: account.wrapIv },
          wrapping,
          account.wrappedKey,
        ),
      ) as Uint8Array<ArrayBuffer>;
      const activeKey = await crypto.subtle.importKey(
        'raw',
        unlockedKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: vault.iv },
        activeKey,
        vault.ciphertext,
      );
      data = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      await updateLocalLogin(normalized, 'failure', vault.revision);
      throw new Error('Email or password is incorrect. Please try again.');
    }
    allAccounts = vault.accounts || [];
    const user = data.workspace.users?.find((u) => u.email === normalized);
    if (data.workspace.users?.length && !user)
      throw new Error('This account no longer has access to the workspace.');
    if (user && !user.active)
      throw new Error('This account has been disabled by your administrator.');
    if (!data.workspace.users?.length)
      data.workspace.users = [
        {
          id: crypto.randomUUID(),
          name: normalized.split('@')[0],
          email: normalized,
          role: 'super_admin',
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
    data.workspace.products ||= [];
    data.workspace.leads ||= [];
    data.workspace.settings ||= {
      quotePrefix: 'ANV',
      validityDays: 30,
      defaultVat: true,
      defaultDesign: 'classic',
      lowStockThreshold: 5,
      defaultLogoWidth: 132,
      appLogo: '',
      favicon: '',
      loginLogoWidth: 150,
      loginBackground: '',
      loginBackgroundColor: '#174A78',
      fiscalYearOverride: '',
      fiscalYearOverrideFor: '',
    };
    data.workspace.sequenceYear ||= '';
    data.workspace.settings.defaultLogoWidth ||= 132;
    if (data.workspace.settings.quotePrefix === 'QT') data.workspace.settings.quotePrefix = 'ANV';
    data.workspace.settings.appLogo ||= '';
    data.workspace.settings.favicon ||= '';
    data.workspace.settings.loginLogoWidth ||= 150;
    data.workspace.settings.loginBackground ||= '';
    data.workspace.settings.loginBackgroundColor ||= '#174A78';
    data.workspace.settings.fiscalYearOverride ||= '';
    data.workspace.settings.fiscalYearOverrideFor ||= '';
    data.workspace.quotations = data.workspace.quotations.map((q) => ({
      ...q,
      status: q.status || 'Valid',
      layout: q.layout || { design: 'classic', logoWidth: 132 },
    }));
  }
  if (data.workspace.company.accent.toLowerCase() === '#184e48')
    data.workspace.company.accent = '#174A78';
  await updateLocalLogin(normalized, 'success', vault.revision);
  activate(unlockedKey, allAccounts, vault.revision, normalized);
  data.email = normalized;
  data.connection.token = ''; // Retire the legacy shared API credential.
  await persistVault(data);
  data.mustChangePassword = !!allAccounts.find((account) => account.email === normalized)
    ?.mustChangePassword;
  return data;
}
// Commit the account envelope and workspace user record in one IndexedDB transaction.
export function manageLocalUsers(
  data: VaultData,
  action: UserAction,
): Promise<VaultData & { temporaryPassword?: string }> {
  if (action.type === 'lock')
    return Promise.reject(
      new Error(
        'Manual sign-in locks require a server workspace. Use Disable for a local account.',
      ),
    );
  const activeKey = key;
  if (!activeKey || !rawKey) return Promise.reject(new Error('Sign in again.'));
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (key !== activeKey || !rawKey) throw new Error('Sign in again.');
      const admin = data.workspace.users.find((u) => u.email === data.email);
      if (!admin?.active || admin.role !== 'super_admin')
        throw new Error('Only a super admin can manage users.');
      let users = [...data.workspace.users];
      let nextAccounts = [...accounts];
      let temporaryPassword: string | undefined;
      if (action.type === 'create') {
        await authRequest(
          data.connection.url ||
            import.meta.env.VITE_API_URL?.trim() ||
            savedServer()?.url ||
            `${location.origin}/api`,
          '/registration-policy',
          {
            email: action.user.email,
          },
        );
        const user = { ...action.user, email: action.user.email.trim().toLowerCase() };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))
          throw new Error('Enter a valid email address.');
        if (
          users.some((u) => u.email === user.email) ||
          nextAccounts.some((a) => a.email === user.email)
        )
          throw new Error('A user with that email already exists.');
        if (action.password.length < 12 || action.password.length > 256)
          throw new Error('Use a password of 12–256 characters.');
        nextAccounts.push(await createAccountKey(user.email, action.password, rawKey));
        users.push(user);
      } else {
        const target = users.find((u) => u.id === action.id);
        if (!target) throw new Error('This user no longer exists.');
        if (target.id === admin.id)
          throw new Error(
            'Use Settings for your own password. Your current account cannot be removed or disabled.',
          );
        if (action.type === 'delete') {
          users = users.filter((u) => u.id !== target.id);
          nextAccounts = nextAccounts.filter((a) => a.email !== target.email);
        } else if (action.type === 'reset') {
          temporaryPassword = btoa(String.fromCharCode(...randomBytes(18)))
            .replaceAll('+', '-')
            .replaceAll('/', '_');
          const replacement = {
            ...(await createAccountKey(target.email, temporaryPassword, rawKey)),
            mustChangePassword: true,
          };
          nextAccounts = [...nextAccounts.filter((a) => a.email !== target.email), replacement];
        } else if (action.type === 'update') {
          users = users.map((u) =>
            u.id === target.id
              ? {
                  ...u,
                  ...(action.role === undefined ? {} : { role: action.role }),
                  ...(action.active === undefined ? {} : { active: action.active }),
                }
              : u,
          );
        }
      }
      if (!users.some((u) => u.role === 'super_admin' && u.active))
        throw new Error('Keep at least one active super admin.');
      const next = { ...data, workspace: { ...data.workspace, users } };
      if (key !== activeKey || !rawKey) throw new Error('Sign in again.');
      const sealed = await seal(next, await activeKey, nextAccounts, revision + 1);
      const clearLoginEmail =
        action.type === 'unlock' || action.type === 'reset' || action.type === 'delete'
          ? data.workspace.users.find((u) => u.id === action.id)?.email
          : undefined;
      await writeVault(sealed, revision, data.email, clearLoginEmail ? [clearLoginEmail] : []);
      if (key === activeKey) {
        accounts = nextAccounts;
        revision++;
      }
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('patra-access');
        channel.postMessage({ source: AUTH_TAB_ID });
        channel.close();
      }
      return { ...next, temporaryPassword };
    });
  queue = task.then(() => {});
  return task;
}

export async function restoreLocalSession(): Promise<VaultData | undefined> {
  let saved: { email?: string; rawKey?: string; lastActivity?: number } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(LOCAL_SESSION_KEY) || 'null');
  } catch {
    return undefined;
  }
  const email = saved?.email?.trim().toLowerCase();
  if (
    !email ||
    !saved?.rawKey ||
    !saved.lastActivity ||
    Date.now() - saved.lastActivity > LOCAL_IDLE_LIMIT
  ) {
    lock();
    return undefined;
  }
  try {
    const vault = await readVault();
    const account = vault?.accounts?.find((item) => item.email === email);
    if (!vault || vault.version !== 2 || !account) throw new Error('Session unavailable.');
    await checkLocalLogin(email);
    const dataKey = Uint8Array.from(atob(saved.rawKey), (character) =>
      character.charCodeAt(0),
    ) as Uint8Array<ArrayBuffer>;
    if (dataKey.byteLength !== 32) throw new Error('Session unavailable.');
    const activeKey = await crypto.subtle.importKey('raw', dataKey, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: vault.iv },
      activeKey,
      vault.ciphertext,
    );
    const data = JSON.parse(new TextDecoder().decode(plain)) as VaultData;
    const user = data.workspace.users.find((item) => item.email === email);
    if (!user?.active) throw new Error('Session unavailable.');
    activate(dataKey, vault.accounts || [], vault.revision, email);
    data.email = email;
    data.connection.token = '';
    data.mustChangePassword = !!account.mustChangePassword;
    return data;
  } catch {
    lock();
    return undefined;
  }
}
export function touchLocalSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(LOCAL_SESSION_KEY) || 'null');
    if (saved?.email && saved?.rawKey) {
      saved.lastActivity = Date.now();
      sessionStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(saved));
    }
  } catch {
    /* Current in-memory session remains usable. */
  }
}

export function isLocalUnlocked() {
  return !!key;
}
// Rewrap only this account's data key; other users keep their own passwords and access.
export function changePassword(
  email: string,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const activeKey = key;
  if (!activeKey || !rawKey)
    return Promise.reject(new Error('Your session is locked. Sign in again.'));
  if (nextPassword === currentPassword)
    return Promise.reject(new Error('Choose a new password different from your current password.'));
  if (nextPassword.length < 12 || nextPassword.length > 256)
    return Promise.reject(new Error('Use a password with at least 12 characters.'));
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (key !== activeKey || !rawKey) throw new Error('Your session is locked. Sign in again.');
      const normalized = email.trim().toLowerCase();
      const account = accounts.find((item) => item.email === normalized);
      if (!account) throw new Error('This login is not available on this device.');
      try {
        const wrapping = await derive(currentPassword, account.salt);
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: account.wrapIv },
          wrapping,
          account.wrappedKey,
        );
      } catch {
        throw new Error('Your current password is incorrect.');
      }
      if (key !== activeKey || !rawKey) throw new Error('Your session is locked. Sign in again.');
      const replacement = await createAccountKey(normalized, nextPassword, rawKey);
      const nextAccounts = accounts.map((item) => (item.email === normalized ? replacement : item));
      const stored = await readVault();
      if (!stored || key !== activeKey || !rawKey)
        throw new Error('Your session is locked. Sign in again.');
      await writeVault(
        { ...stored, accounts: nextAccounts, revision: revision + 1 },
        revision,
        normalized,
      );
      if (key === activeKey) {
        accounts = nextAccounts;
        revision++;
      }
    });
  queue = task;
  return task;
}
export function lock() {
  try {
    sessionStorage.removeItem(LOCAL_SESSION_KEY);
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* Session storage may be disabled. */
  }
  key = null;
  if (rawKey) rawKey.fill(0);
  rawKey = null;
  accounts = [];
}
export function persistVault(data: VaultData): Promise<void> {
  const activeKeyPromise = key;
  const activeRawKey = rawKey;
  if (!activeKeyPromise || !activeRawKey)
    return Promise.reject(new Error('Your session is locked. Sign in again.'));
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (key !== activeKeyPromise || !rawKey) throw new Error('Your session is locked.');
      const activeKey = await activeKeyPromise;
      const vault = await seal(data, activeKey, accounts, revision + 1);
      await writeVault(vault, revision, data.email);
      revision++;
      saveLocalSession(data.email, activeRawKey);
      await setBranding(data);
    });
  queue = task;
  return task;
}

export async function localAccountLocks(data: VaultData): Promise<Record<string, number>> {
  const actor = data.workspace.users.find((u) => u.email === data.email);
  if (!key || !actor?.active || actor.role !== 'super_admin')
    throw new Error('Only a super admin can view account locks.');
  await checkLocalLogin(data.email);
  const values = await Promise.all(
    data.workspace.users.map(async (user) => {
      const state = await localLoginState(user.email);
      return [user.id, state?.lockedUntil || 0] as const;
    }),
  );
  return Object.fromEntries(values.filter(([, until]) => until > Date.now()));
}
