import { useEffect, useRef, useState } from 'react';
import { Building2, LockKeyhole, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { masterRequest } from '../lib/master';
import { emptyWorkspace } from '../domain/defaults';
import type { CompanyWorkspace, WorkspaceUser } from '../domain/types';
import { Avatar, ErrorText, Field, Modal, Spinner } from './ui';
export function OwnerCompanies() {
  const [companies, setCompanies] = useState<CompanyWorkspace[]>([]);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [editing, setEditing] = useState<CompanyWorkspace | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CompanyWorkspace | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function refresh() {
    const result = await masterRequest('/companies');
    setCompanies(result.companies);
    setUsers(result.users);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  function open(company: CompanyWorkspace | 'new') {
    setEditing(company);
    setError('');
    setMessage('');
    setSearch('');
    setName(company === 'new' ? '' : company.name);
    setPrefix(company === 'new' ? '' : company.prefix);
    setMembers(company === 'new' ? [] : company.memberIds || []);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    if (
      !members.some((id) => users.some((u) => u.id === id && u.active && u.role === 'super_admin'))
    ) {
      setError('Choose at least one active super admin.');
      return;
    }
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      if (editing === 'new') {
        const workspace = emptyWorkspace(name.trim());
        workspace.settings.quotePrefix = prefix.trim().toUpperCase();
        workspace.company.slogan = '';
        await masterRequest('/companies', { workspace, memberIds: members });
      } else if (editing) {
        await masterRequest(`/companies/${editing.id}`, { memberIds: members }, 'PUT');
      }
      await refresh();
      setEditing(null);
      setMessage('Company workspace and access saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function deleteCompany(event: React.FormEvent) {
    event.preventDefault();
    if (!deleting || operation.current || confirmation.trim() !== deleting.name.trim()) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await masterRequest(
        `/companies/${deleting.id}`,
        { name: confirmation, revision: deleting.revision },
        'DELETE',
      );
      setCompanies(result.companies);
      setMessage(`${deleting.name} was deleted. Shared user accounts were kept.`);
      setDeleting(null);
      setConfirmation('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel owner-companies">
      <div className="panel-heading">
        <div>
          <h2>
            <Building2 size={20} /> Company Workspaces
          </h2>
          <p>
            Separate business records and branding. One account, with company access assigned here.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="icon-button"
            aria-label="Refresh Companies"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void refresh()
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="button primary small"
            onClick={() => open('new')}
            disabled={busy || !companies.length}
          >
            <Plus size={16} /> Add Company
          </button>
        </div>
      </div>
      <div className="panel-body">
        {!editing && !deleting && <ErrorText>{error}</ErrorText>}
        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}
        {!companies.length && (
          <p className="muted">
            Create the first server workspace below. You can then add more companies here.
          </p>
        )}
        <div className="company-cards">
          {companies.map((company) => (
            <article className="company-card" key={company.id}>
              <Avatar name={company.name} photo={company.logo} />
              <div>
                <h3>{company.name}</h3>
                <p>
                  {company.memberIds?.length || 0} assigned users · {company.prefix}
                </p>
                {company.id === 'primary' && <small>Original workspace</small>}
              </div>
              <div className="company-card-actions">
                <button className="button small" disabled={busy} onClick={() => open(company)}>
                  <Users size={15} /> Manage Access
                </button>
                {company.id === 'primary' ? (
                  <span
                    className="company-protected"
                    title="The original workspace holds installation defaults and cannot be deleted."
                  >
                    <LockKeyhole size={14} aria-hidden="true" /> Protected
                  </span>
                ) : (
                  <button
                    className="icon-button danger-button"
                    aria-label={`Delete ${company.name}`}
                    title="Delete Workspace"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(company);
                      setConfirmation('');
                      setError('');
                      setMessage('');
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      {deleting && (
        <Modal
          title="Delete Company Workspace"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <form onSubmit={deleteCompany}>
            <fieldset className="modal-body operation-fields company-delete-body" disabled={busy}>
              <p>
                Permanently delete <strong>{deleting.name}</strong> and its customers, products, CRM
                records, quotations, company settings and email history?
              </p>
              <p className="muted">
                Assigned users will lose access to this company. Shared accounts, other companies,
                security audit logs and Cloudinary images are kept. This cannot be undone.
              </p>
              <Field label="Type The Company Name To Confirm" hint={deleting.name}>
                <input
                  autoFocus
                  required
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={Math.max(150, deleting.name.length)}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
              <ErrorText>{error}</ErrorText>
            </fieldset>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                className="button company-delete-button"
                disabled={busy || confirmation.trim() !== deleting.name.trim()}
              >
                {busy ? <Spinner /> : <Trash2 size={16} />}
                {busy ? 'Deleting Workspace…' : 'Delete Workspace'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal
          title={editing === 'new' ? 'Create Company Workspace' : `Access to ${name}`}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy} className="modal-body operation-fields">
              {editing === 'new' && (
                <div className="form-grid">
                  <Field label="Company Name *">
                    <input
                      required
                      maxLength={150}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Quotation Prefix *">
                    <input
                      required
                      maxLength={15}
                      pattern="[A-Za-z0-9_-]+"
                      placeholder="e.g. ABC"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                    />
                  </Field>
                </div>
              )}
              <Field
                label="Assign Existing Users"
                hint="Select at least one super admin. Shared accounts keep their password, MFA and profile across assigned companies."
              >
                <input
                  type="search"
                  placeholder="Search name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <div className="company-access-list">
                {users
                  .filter((u) =>
                    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((user) => (
                    <label className="company-access-row" key={user.id}>
                      <input
                        type="checkbox"
                        checked={members.includes(user.id)}
                        onChange={(e) =>
                          setMembers((old) =>
                            e.target.checked
                              ? [...old, user.id]
                              : old.filter((id) => id !== user.id),
                          )
                        }
                      />
                      <Avatar name={user.name} photo={user.photo} />
                      <span>
                        <strong>{user.name}</strong>
                        <small>
                          {user.email} · {user.role === 'super_admin' ? 'Super Admin' : 'User'}
                          {!user.active ? ' · Disabled' : ''}
                        </small>
                      </span>
                    </label>
                  ))}
              </div>
              <p className="muted">
                Customers, products, CRM, quotations, numbering, branding and default BCC stay
                separate. User roles and personal profiles are shared. New accounts created within a
                company receive access to that company only.
              </p>
              <ErrorText>{error}</ErrorText>
            </fieldset>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy || !members.length}>
                {busy && <Spinner />}
                {editing === 'new' ? 'Create Company' : 'Save Access'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
