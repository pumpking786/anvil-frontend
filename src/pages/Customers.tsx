import { ViewSwitcher, useCollectionView } from '../components/ViewSwitcher';
import { CategoryBadge, CategoryIcon } from '../components/CategoryIdentity';
import { EmailHistoryDetails } from '../components/EmailHistory';
import { removeCustomer } from '../domain/customer';
import { useUiState } from '../lib/uiState';
import { useMemo, useState, useCallback, useRef } from 'react';
import { Building2, Mail, MapPin, Pencil, Plus, Search, Users, Trash2 } from 'lucide-react';
import { CATEGORIES, type Customer, type Connection, type Workspace } from '../domain/types';
import { Avatar, ErrorText, Field, ImageUpload, Modal, Spinner } from '../components/ui';
export function Customers({
  workspace,
  connection,
  canViewEmailHistory = false,
  onSave,
  notify,
}: {
  workspace: Workspace;
  connection: Connection;
  canViewEmailHistory?: boolean;
  onSave: (w: Workspace) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [search, setSearch] = useUiState('Customers.search', '');
  const [view, setView] = useCollectionView('customers');
  const [category, setCategory] = useUiState('Customers.category', 'All');
  const [editing, setEditing] = useUiState<Customer | null>('Customers.editing', null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const filtered = useMemo(
    () =>
      workspace.customers.filter(
        (c) =>
          (category === 'All' || c.category === category) &&
          `${c.name} ${c.email} ${c.contactName || ''} ${c.contactEmail || ''} ${c.pan}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [workspace.customers, search, category],
  );
  const close = useCallback(() => {
    if (!busy) setEditing(null);
  }, [busy]);
  function edit(customer?: Customer) {
    setErrors({});
    setEditing(
      customer
        ? { ...customer }
        : {
            id: crypto.randomUUID(),
            name: '',
            pan: '',
            address: '',
            email: '',
            contactName: '',
            contactEmail: '',
            phone: '',
            category: 'Enterprise',
            photo: '',
          },
    );
  }
  const change = (key: keyof Customer, value: string) =>
    setEditing((c) => (c ? { ...c, [key]: value } : c));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR BUSINESS NETWORK</span>
          <h1>
            Customers<span className="count-badge">{workspace.customers.length}</span>
          </h1>
          <p>Good relationships start with the right details.</p>
        </div>
        <button className="button primary" onClick={() => edit()}>
          <Plus size={17} />
          New Customer
        </button>
      </div>
      <div className="list-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search Customers"
            placeholder="Search company, contact, email or VAT / PAN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter Customer Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="result-count">{filtered.length} customers</span>
        <ViewSwitcher value={view} onChange={setView} label="Customers View" />
      </div>
      {filtered.length ? (
        view === 'list' ? (
          <div className="collection-table-wrap">
            <table className="collection-table" aria-label="Customers">
              <caption className="sr-only">Customers</caption>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>VAT / PAN</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <button
                        className="collection-name customer-name"
                        onClick={() => edit(customer)}
                      >
                        {customer.photo ? (
                          <Avatar name={customer.name} photo={customer.photo} />
                        ) : (
                          <CategoryIcon category={customer.category} kind="customer" />
                        )}
                        <span>{customer.name}</span>
                      </button>
                    </td>
                    <td>
                      <CategoryBadge category={customer.category} kind="customer" />
                    </td>
                    <td>{customer.contactName || '—'}</td>
                    <td>{customer.contactEmail || customer.email || '—'}</td>
                    <td>{customer.phone || '—'}</td>
                    <td>{customer.pan || '—'}</td>
                    <td>
                      <div className="record-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit ${customer.name}`}
                          title={`Edit ${customer.name}`}
                          disabled={busy}
                          onClick={() => edit(customer)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${customer.name}`}
                          title={`Delete ${customer.name}`}
                          disabled={busy}
                          onClick={() => setDeleting(customer)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="customer-grid">
            {filtered.map((customer) => (
              <button
                type="button"
                className="customer-card"
                onClick={() => edit(customer)}
                key={customer.id}
                disabled={busy}
                aria-label={`Edit ${customer.name}`}
                title={`Edit ${customer.name}`}
              >
                <div className="customer-card-top">
                  {customer.photo ? (
                    <Avatar name={customer.name} photo={customer.photo} size="large" />
                  ) : (
                    <CategoryIcon category={customer.category} kind="customer" large />
                  )}
                  <Pencil size={18} aria-hidden="true" />
                </div>
                <CategoryBadge category={customer.category} kind="customer" />
                <h3>{customer.name}</h3>
                {customer.contactName && (
                  <p>
                    <Users size={14} />
                    {customer.contactName}
                  </p>
                )}
                <p>
                  <MapPin size={14} />
                  {customer.address || 'Address not added'}
                </p>
                <p>
                  <Mail size={14} />
                  {customer.contactEmail || customer.email || 'Email not added'}
                </p>
                <div className="customer-card-footer">
                  <Building2 size={14} />
                  <span>VAT / PAN</span>
                  <strong>{customer.pan || '—'}</strong>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Users size={28} />
          </span>
          <h2>
            {search || category !== 'All'
              ? 'No Matching Customers'
              : 'Every quotation starts with a customer.'}
          </h2>
          <p>
            {search || category !== 'All'
              ? 'Try another name or category.'
              : 'Add their details once. Keep every quotation personal and accurate.'}
          </p>
          {!search && category === 'All' && (
            <button className="button primary" onClick={() => edit()}>
              <Plus size={16} />
              Add Your First Customer
            </button>
          )}
        </div>
      )}
      {editing && !deleting && (
        <Modal
          title={
            workspace.customers.some((c) => c.id === editing.id) ? 'Edit Customer' : 'New Customer'
          }
          subtitle="Keep their details ready for your next quotation."
          onClose={close}
        >
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (operation.current) return;
              const next: Record<string, string> = {};
              if (!editing.name.trim()) next.name = 'Enter the customer or company name.';
              if (editing.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email))
                next.email = 'Enter a valid email address.';
              if (
                editing.contactEmail?.trim() &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.contactEmail.trim())
              )
                next.contactEmail = 'Enter a valid contact email address.';
              setErrors(next);
              if (Object.keys(next).length) return;
              operation.current = true;
              setBusy(true);
              try {
                const customer = {
                  ...editing,
                  name: editing.name.trim(),
                  contactName: editing.contactName?.trim() || '',
                  contactEmail: editing.contactEmail?.trim() || '',
                };
                await onSave({
                  ...workspace,
                  customers: workspace.customers.some((c) => c.id === customer.id)
                    ? workspace.customers.map((c) => (c.id === customer.id ? customer : c))
                    : [...workspace.customers, customer],
                });
                setEditing(null);
                notify('Customer saved');
              } catch (err) {
                setErrors({ form: (err as Error).message });
              } finally {
                operation.current = false;
                setBusy(false);
              }
            }}
          >
            <fieldset className="modal-body operation-fields" disabled={busy}>
              <ImageUpload
                label="Customer Photo"
                value={editing.photo}
                onChange={(value) => change('photo', value)}
                round
              />
              <Field label="Customer / Company Name *" error={errors.name}>
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => change('name', e.target.value)}
                  placeholder="Full business name"
                  maxLength={150}
                />
              </Field>
              <div className="form-grid">
                <Field label="Category">
                  <select
                    value={editing.category}
                    onChange={(e) => change('category', e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="VAT / PAN Number">
                  <input
                    value={editing.pan}
                    onChange={(e) => change('pan', e.target.value)}
                    placeholder="e.g. 600123456"
                    maxLength={30}
                  />
                </Field>
              </div>
              <Field label="Address">
                <textarea
                  rows={2}
                  value={editing.address}
                  onChange={(e) => change('address', e.target.value)}
                  placeholder="Street, city, Nepal"
                  maxLength={500}
                />
              </Field>
              <div className="form-grid">
                <Field label="Email Address" error={errors.email}>
                  <input
                    type="email"
                    value={editing.email}
                    onChange={(e) => change('email', e.target.value)}
                    placeholder="name@company.com"
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    type="tel"
                    value={editing.phone}
                    onChange={(e) => change('phone', e.target.value)}
                    placeholder="+977"
                    maxLength={40}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Contact Person" hint="The person representing this company.">
                  <input
                    value={editing.contactName || ''}
                    maxLength={150}
                    placeholder="e.g. Asha Shrestha"
                    onChange={(e) => change('contactName', e.target.value)}
                  />
                </Field>
                <Field
                  label="Contact Email"
                  error={errors.contactEmail}
                  hint="Quotation emails use this address when provided."
                >
                  <input
                    type="email"
                    value={editing.contactEmail || ''}
                    maxLength={254}
                    placeholder="asha@company.com"
                    onChange={(e) => change('contactEmail', e.target.value)}
                  />
                </Field>
              </div>
              <ErrorText>{errors.form}</ErrorText>
            </fieldset>
            <div className="modal-actions">
              {workspace.customers.some((c) => c.id === editing.id) && (
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={() => {
                    setErrors({});
                    setDeleting(editing);
                  }}
                >
                  <Trash2 size={16} /> Delete Customer
                </button>
              )}
              <button type="button" className="button" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy && <Spinner />}Save Customer
              </button>
            </div>
          </form>
          {canViewEmailHistory && (
            <EmailHistoryDetails
              title="Customer Email History"
              connection={connection}
              customerId={editing.id}
            />
          )}
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete Customer?"
          subtitle={deleting.name}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="modal-body">
            <p>
              This removes the customer from your list. Existing quotations keep their saved
              customer details. Linked CRM opportunities remain, with the customer link cleared.
            </p>
            <ErrorText>{errors.form}</ErrorText>
          </div>
          <div className="modal-actions">
            <button className="button" disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (operation.current) return;
                operation.current = true;
                setBusy(true);
                setErrors({});
                try {
                  await onSave(removeCustomer(workspace, deleting.id));
                  setEditing(null);
                  setDeleting(null);
                  notify('Customer deleted');
                } catch (error) {
                  setErrors({ form: (error as Error).message });
                } finally {
                  operation.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy ? <Spinner /> : <Trash2 size={16} />}Delete Customer Permanently
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
