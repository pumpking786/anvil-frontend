import { ProductDialog, emptyProduct } from '../components/ProductDialog';
import { CategoryBadge, CategoryIcon } from '../components/CategoryIdentity';
import { ViewSwitcher, useCollectionView } from '../components/ViewSwitcher';
import { useUiState } from '../lib/uiState';
import { LOGIN_POLICY_TEXT } from '../lib/loginPolicy';
import { RoleSelector } from '../components/RoleSelector';
import { CreatedDate } from '../components/CreatedDate';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Activity,
  Archive,
  Boxes,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  UserX,
  UserCheck,
  KeyRound,
  Copy,
  RefreshCw,
  LockKeyhole,
  LockKeyholeOpen,
} from 'lucide-react';
import type {
  Product,
  Workspace,
  WorkspaceUser,
  WorkspaceRole,
  UserAction,
  AccountAccess,
} from '../domain/types';
import { money } from '../domain/quotation';
import { Avatar, ErrorText, Field, Modal, Spinner } from '../components/ui';

type Save = (w: Workspace) => Promise<void>;

export function Products({
  workspace,
  onSave,
  notify,
}: {
  workspace: Workspace;
  onSave: Save;
  notify: (s: string) => void;
}) {
  const [query, setQuery] = useUiState('BusinessModules.query', '');
  const [view, setView] = useCollectionView('products');
  const [editing, setEditing] = useUiState<Product | null>('Products.editing', null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState('');
  const filtered = useMemo(
    () =>
      workspace.products.filter((p) =>
        `${p.name} ${p.topic} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [workspace.products, query],
  );
  const low = workspace.products.filter(
    (p) => p.trackInventory && p.quantityOnHand <= p.reorderLevel,
  ).length;
  function edit(product: Product) {
    setEditing({ ...product });
    setError('');
  }
  async function remove(product: Product) {
    if (operation.current) return;
    if (
      !confirm(
        `Remove ${product.name} from the catalog? Existing quotations keep their saved line items.`,
      )
    )
      return;
    operation.current = true;
    setBusy(true);
    setRemoving(product.id);
    try {
      await onSave({
        ...workspace,
        products: workspace.products.filter((p) => p.id !== product.id),
      });
      notify('Product removed');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
      setRemoving('');
    }
  }
  return (
    <div className="business-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATALOG & STOCK</span>
          <h1>Products</h1>
          <p>Keep descriptions, selling prices, and quantities ready for quotations.</p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            setEditing(emptyProduct(workspace.settings.lowStockThreshold));
            setError('');
          }}
        >
          <Plus size={16} />
          New Product
        </button>
      </div>
      <div className="business-metrics">
        <article>
          <Boxes />
          <span>Catalog</span>
          <strong>{workspace.products.length}</strong>
        </article>
        <article>
          <Archive />
          <span>Tracked stock</span>
          <strong>{workspace.products.filter((p) => p.trackInventory).length}</strong>
        </article>
        <article className={low ? 'metric-warning' : ''}>
          <Activity />
          <span>At reorder point</span>
          <strong>{low}</strong>
        </article>
      </div>
      <div className="business-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search Products"
            placeholder="Search name, topic, or SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span>{filtered.length} products</span>
        <ViewSwitcher value={view} onChange={setView} label="Products View" />
      </div>
      <ErrorText>{error}</ErrorText>
      {filtered.length ? (
        view === 'list' ? (
          <div className="collection-table-wrap">
            <table className="collection-table">
              <caption className="sr-only">Products</caption>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>SKU</th>
                  <th className="numeric">Sales Price</th>
                  <th className="numeric">On Hand</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <button
                        className="collection-name"
                        disabled={busy}
                        onClick={() => edit(product)}
                      >
                        <CategoryIcon category={product.topic} kind="product" />
                        <span>{product.name}</span>
                      </button>
                    </td>
                    <td>
                      <CategoryBadge category={product.topic} kind="product" icon={false} />
                    </td>
                    <td>{product.sku || '—'}</td>
                    <td className="numeric">NPR {money(product.salePrice)}</td>
                    <td
                      className={`numeric ${product.trackInventory && product.quantityOnHand <= product.reorderLevel ? 'stock-low' : ''}`}
                    >
                      {product.trackInventory ? product.quantityOnHand : 'Not tracked'}
                    </td>
                    <td>
                      <div className="record-actions">
                        <button
                          type="button"
                          className="icon-button"
                          disabled={busy}
                          aria-label={`Edit ${product.name}`}
                          title={`Edit ${product.name}`}
                          onClick={() => edit(product)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={busy}
                          aria-label={`Remove ${product.name}`}
                          title={`Remove ${product.name}`}
                          onClick={() => void remove(product)}
                        >
                          {removing === product.id ? <Spinner /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="product-grid">
            {filtered.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-card-head">
                  <div className="product-category-identity">
                    <CategoryIcon category={product.topic} kind="product" large />
                    <CategoryBadge category={product.topic} kind="product" icon={false} />
                  </div>
                  <div className="record-actions">
                    <button
                      type="button"
                      className="icon-button"
                      disabled={busy}
                      aria-label={`Edit ${product.name}`}
                      title={`Edit ${product.name}`}
                      onClick={() => edit(product)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label={`Remove ${product.name}`}
                      title={`Remove ${product.name}`}
                      onClick={() => void remove(product)}
                    >
                      {removing === product.id ? <Spinner /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
                <h2>{product.name}</h2>
                <div className="product-sku">{product.sku ? `SKU · ${product.sku}` : 'No SKU'}</div>
                <div className="product-card-foot">
                  <span>
                    <small>SALE PRICE</small>
                    <strong>NPR {money(product.salePrice)}</strong>
                  </span>
                  <span>
                    <small>ON HAND</small>
                    <strong
                      className={
                        product.trackInventory && product.quantityOnHand <= product.reorderLevel
                          ? 'stock-low'
                          : ''
                      }
                    >
                      {product.trackInventory ? product.quantityOnHand : 'Not Tracked'}
                      {product.trackInventory && ' units'}
                    </strong>
                  </span>
                </div>
                <button className="text-button" disabled={busy} onClick={() => edit(product)}>
                  Edit Product & Stock
                </button>
              </article>
            ))}
          </div>
        )
      ) : (
        <div className="business-empty">
          <Boxes />
          <h2>{query ? 'No Matching Products' : 'Your Catalog Is Ready To Grow'}</h2>
          <p>
            Add products and services to insert their sales descriptions and prices into quotations.
          </p>
          {!query && (
            <button className="button primary" onClick={() => setEditing(emptyProduct())}>
              Add First Product
            </button>
          )}
        </div>
      )}
      {editing && (
        <ProductDialog
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          title={
            workspace.products.some((p) => p.id === editing.id) ? 'Edit Product' : 'New Product'
          }
          onSave={async (product) => {
            await onSave({
              ...workspace,
              products: workspace.products.some((p) => p.id === product.id)
                ? workspace.products.map((p) => (p.id === product.id ? product : p))
                : [product, ...workspace.products],
            });
            notify('Product saved');
          }}
        />
      )}
    </div>
  );
}

export function AdminUsers({
  workspace,
  onAction,
  onReadLocks,
  currentEmail,
  isRemote,
  notify,
}: {
  workspace: Workspace;
  onAction: (action: UserAction) => Promise<string | undefined>;
  onReadLocks: () => Promise<Record<string, AccountAccess>>;
  currentEmail: string;
  isRemote: boolean;
  notify: (s: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('user');
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{
    type: 'delete' | 'reset' | 'lock';
    user: WorkspaceUser;
  } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [locks, setLocks] = useState<Record<string, AccountAccess>>({});
  const [lockError, setLockError] = useState('');
  const [locksLoading, setLocksLoading] = useState(false);
  const lockRequest = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (operation.current || document.visibilityState !== 'visible') return;
      const request = ++lockRequest.current;
      try {
        const value = await onReadLocks();
        if (active && request === lockRequest.current) {
          setLocks(value);
          setLockError('');
        }
      } catch (error) {
        if (active && request === lockRequest.current) setLockError((error as Error).message);
      }
    };
    void refresh();
    const onFocus = () => void refresh();
    const timer = setInterval(onFocus, 10000);
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [onReadLocks]);
  async function refreshLocks() {
    const request = ++lockRequest.current;
    setLocksLoading(true);
    try {
      const value = await onReadLocks();
      if (request === lockRequest.current) {
        setLocks(value);
        setLockError('');
      }
    } catch (error) {
      if (request === lockRequest.current) setLockError((error as Error).message);
    } finally {
      setLocksLoading(false);
    }
  }

  async function run(action: UserAction, message: string) {
    if (operation.current) return false;
    operation.current = true;
    lockRequest.current++;
    setBusy(true);
    setError('');
    try {
      await onAction(action);
      await refreshLocks();
      notify(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setResetPassword('');
    setCopied(false);
  }
  function open(type: 'delete' | 'reset' | 'lock', user: WorkspaceUser) {
    setDialog({ type, user });
    setResetPassword('');
    setCopied(false);
    setDialogError('');
  }
  return (
    <div className="business-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE ACCESS</span>
          <h1>Users & Roles</h1>
          <p>Separate sign-ins. Clear responsibilities. Access you control.</p>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
      {busy && (
        <p className="operation-status" role="status">
          <Spinner /> Updating user access…
        </p>
      )}
      <div className="admin-user-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>Workspace Users</h2>
            <button
              type="button"
              className="button small"
              disabled={busy || locksLoading}
              onClick={() => void refreshLocks()}
            >
              <RefreshCw size={14} />
              Refresh Access
            </button>
          </div>
          <div className="account-lock-policy">
            <Shield size={16} />
            <p>
              {LOGIN_POLICY_TEXT} Unlock users here to restore access. Owner locks must be removed
              by the owner.
            </p>
          </div>
          {lockError && (
            <div className="panel-body">
              <ErrorText>{lockError}</ErrorText>
            </div>
          )}
          <div className="admin-user-list">
            {workspace.users.map((user) => (
              <article key={user.id} className="admin-user-row">
                <Avatar name={user.name} photo={user.photo} size="user-row-avatar" />
                <div className="admin-user-info">
                  <strong>
                    {user.name}
                    {user.email === currentEmail ? ' · You' : ''}
                  </strong>
                  <span>{user.email}</span>
                  <CreatedDate value={user.createdAt} />
                </div>
                <span className={`role-pill ${user.role}`}>
                  {user.role === 'super_admin' ? 'Super Admin' : 'User'}
                </span>
                <div className="user-access">
                  <span
                    className={
                      !user.active
                        ? 'access-disabled'
                        : locks[user.id]?.manual || (locks[user.id]?.lockedUntil || 0) > Date.now()
                          ? 'access-locked'
                          : 'access-active'
                    }
                  >
                    {!user.active
                      ? 'Disabled'
                      : locks[user.id]?.manual
                        ? locks[user.id]?.ownerLocked
                          ? 'Locked by owner'
                          : 'Locked'
                        : (locks[user.id]?.lockedUntil || 0) > Date.now()
                          ? 'Temporarily blocked'
                          : 'Active'}
                  </span>
                  {(locks[user.id]?.lockedUntil || 0) > Date.now() && (
                    <small className="account-lock-until">
                      Until{' '}
                      {new Date(locks[user.id]?.lockedUntil || 0).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </small>
                  )}
                  {user.email !== currentEmail && (
                    <div className="user-actions">
                      {isRemote && (
                        <button
                          className="icon-button danger-button"
                          disabled={busy || !!locks[user.id]?.manual || !user.active}
                          title="Lock Sign-In"
                          aria-label={`Lock sign-in for ${user.name}`}
                          onClick={() => open('lock', user)}
                        >
                          <LockKeyhole size={17} />
                        </button>
                      )}
                      <button
                        className="icon-button unlock-account"
                        disabled={busy || !!locks[user.id]?.ownerLocked}
                        title={
                          locks[user.id]?.ownerLocked
                            ? 'Ask The Owner To Unlock This Account'
                            : 'Unlock Sign-In And Clear Failed Attempts'
                        }
                        aria-label={`Unlock sign-in for ${user.name}`}
                        onClick={() =>
                          void run(
                            { type: 'unlock', id: user.id },
                            user.active
                              ? 'Sign-in unlocked. Failed attempts cleared.'
                              : 'Sign-in unblocked. The account is still disabled.',
                          )
                        }
                      >
                        <LockKeyholeOpen size={17} />
                      </button>
                      <RoleSelector
                        compact
                        label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={busy || !!locks[user.id]?.ownerLocked}
                        onChange={(role) =>
                          void run({ type: 'update', id: user.id, role }, 'User role updated')
                        }
                      />
                      <button
                        className="icon-button"
                        disabled={busy || !!locks[user.id]?.ownerLocked}
                        aria-label={`${user.active ? 'Disable' : 'Enable'} ${user.name}`}
                        title={user.active ? 'Disable Account' : 'Enable Account'}
                        onClick={() =>
                          void run(
                            { type: 'update', id: user.id, active: !user.active },
                            user.active ? 'Account disabled' : 'Account enabled',
                          )
                        }
                      >
                        {user.active ? <UserX size={17} /> : <UserCheck size={17} />}
                      </button>
                      <button
                        className="icon-button"
                        disabled={busy || !!locks[user.id]?.ownerLocked}
                        aria-label={`Reset password for ${user.name}`}
                        title="Reset Password"
                        onClick={() => open('reset', user)}
                      >
                        <KeyRound size={17} />
                      </button>
                      <button
                        className="icon-button danger-button"
                        disabled={busy || !!locks[user.id]?.ownerLocked}
                        aria-label={`Delete ${user.name}`}
                        title="Delete Account"
                        onClick={() => open('delete', user)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Create User</h2>
            <UserPlus size={18} />
          </div>
          <form
            className="panel-body"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || !email.trim()) {
                setError('Add the user’s name and email.');
                return;
              }
              const user: WorkspaceUser = {
                id: crypto.randomUUID(),
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role,
                active: true,
                createdAt: new Date().toISOString(),
              };
              if (await run({ type: 'create', user, password }, 'User created')) {
                setName('');
                setEmail('');
                setPassword('');
                setRole('user');
              }
            }}
          >
            <p className="section-description">
              Users can manage customers, quotations, products, and CRM. Super Admins also manage
              settings and account access.
            </p>
            <fieldset disabled={busy}>
              <Field label="Full Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field
                label="Temporary Password"
                hint="12–256 characters. Share privately; the user can change it in Settings."
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={256}
                  required
                />
              </Field>
              <RoleSelector value={role} onChange={setRole} disabled={busy} />
              <button className="button primary full-width create-account-action" disabled={busy}>
                {busy ? <Spinner /> : <UserPlus size={15} />}Create Account
              </button>
            </fieldset>
          </form>
        </section>
      </div>
      <div className="notice-card">
        <Shield size={18} />
        <p>
          {isRemote
            ? 'Server accounts use secure sign-in sessions. Disabling, deleting, changing a role, or resetting a password revokes existing sessions immediately.'
            : 'Accounts unlock an encrypted workspace on this browser. A super admin can reset a teammate’s password. Keep access to at least one super admin account.'}
        </p>
      </div>
      {dialog && (
        <Modal
          title={
            dialog.type === 'delete'
              ? 'Delete User Account'
              : dialog.type === 'lock'
                ? 'Lock User Account'
                : 'Reset User Password'
          }
          onClose={closeDialog}
        >
          <form
            className="user-action-dialog"
            onSubmit={async (e) => {
              e.preventDefault();
              if (operation.current || resetPassword) return;
              setDialogError('');
              operation.current = true;
              setBusy(true);
              try {
                const generatedPassword = await onAction(
                  dialog.type === 'delete'
                    ? { type: 'delete', id: dialog.user.id }
                    : dialog.type === 'lock'
                      ? { type: 'lock', id: dialog.user.id }
                      : { type: 'reset', id: dialog.user.id },
                );
                if (dialog.type === 'reset' && generatedPassword)
                  setResetPassword(generatedPassword);
                notify(
                  dialog.type === 'delete'
                    ? 'User deleted'
                    : dialog.type === 'lock'
                      ? 'Account locked. Active sessions revoked.'
                      : 'Temporary password generated.',
                );
                await refreshLocks();
                if (dialog.type !== 'reset') setDialog(null);
              } catch (error) {
                setDialogError((error as Error).message);
              } finally {
                operation.current = false;
                setBusy(false);
              }
            }}
          >
            <div className="modal-body">
              <p>
                {dialog.type === 'delete'
                  ? `Remove ${dialog.user.name} (${dialog.user.email}) and their sign-in access? Existing customer and quotation records will be retained.`
                  : dialog.type === 'lock'
                    ? `Lock sign-in for ${dialog.user.name}? Their current sessions will end immediately. They will need an administrator to unlock their account.`
                    : resetPassword
                      ? `Temporary password for ${dialog.user.name} (${dialog.user.email}). Copy it now and share it privately. It will not be shown again after closing this window.`
                      : `Generate a temporary password for ${dialog.user.name}? Their old password and sessions will stop working. They must choose a new password after signing in. MFA stays enabled.`}
              </p>
              {dialog.type === 'reset' && !dialog.user.active && (
                <p className="field-hint">
                  This account is disabled. Enable it before the user can sign in.
                </p>
              )}
              {dialog.type === 'reset' && resetPassword && (
                <Field
                  label="Generated Temporary Password"
                  hint="Use this password at the workspace sign-in page. The user will then choose their own password."
                >
                  <input
                    value={resetPassword}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    onFocus={(event) => event.target.select()}
                  />
                  <button
                    className="button"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(resetPassword);
                        setCopied(true);
                      } catch {
                        setDialogError(
                          'Select and copy the temporary password from the field above.',
                        );
                      }
                    }}
                  >
                    <Copy size={16} />
                    {copied ? 'Copied' : 'Copy Password'}
                  </button>
                </Field>
              )}
              <ErrorText>{dialogError}</ErrorText>
            </div>
            <div className="modal-actions">
              <button className="button" type="button" disabled={busy} onClick={closeDialog}>
                {resetPassword ? 'Done' : 'Cancel'}
              </button>
              {!resetPassword && (
                <button
                  className={`button ${dialog.type !== 'reset' ? 'danger' : 'primary'}`}
                  disabled={busy}
                >
                  {busy ? (
                    <Spinner />
                  ) : dialog.type === 'delete' ? (
                    <Trash2 size={16} />
                  ) : dialog.type === 'lock' ? (
                    <LockKeyhole size={16} />
                  ) : (
                    <KeyRound size={16} />
                  )}{' '}
                  {dialog.type === 'delete'
                    ? 'Delete User'
                    : dialog.type === 'lock'
                      ? 'Lock Account'
                      : 'Generate Temporary Password'}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
