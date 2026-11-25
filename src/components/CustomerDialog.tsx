import { useRef, useState } from 'react';
import { CATEGORIES, type Customer } from '../domain/types';
import { ErrorText, Field, ImageUpload, Modal, Spinner } from './ui';
export function CustomerDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
}) {
  const [value, setValue] = useState<Customer>(() => ({
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
  }));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = (key: keyof Customer, field: string) =>
    setValue((old) => ({ ...old, [key]: field }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const next: Record<string, string> = {};
    if (!value.name.trim()) next.name = 'Enter the customer or company name.';
    for (const key of ['email', 'contactEmail'] as const)
      if (value[key]?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value[key]!.trim()))
        next[key] = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length) return;
    pending.current = true;
    setBusy(true);
    try {
      await onSave({
        ...value,
        name: value.name.trim(),
        email: value.email.trim(),
        contactEmail: value.contactEmail?.trim() || '',
      });
      onClose();
    } catch (error) {
      setErrors({ form: (error as Error).message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="New Customer"
      subtitle="Create and select the customer for this quotation."
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <form noValidate onSubmit={save}>
        <fieldset className="modal-body operation-fields" disabled={busy}>
          <ImageUpload
            label="Customer Photo"
            value={value.photo}
            onChange={(value) => change('photo', value)}
            round
          />
          <Field label="Customer / Company Name *" error={errors.name}>
            <input
              autoFocus
              value={value.name}
              onChange={(e) => change('name', e.target.value)}
              placeholder="Full business name"
              maxLength={150}
            />
          </Field>
          <div className="form-grid">
            <Field label="Category">
              <select value={value.category} onChange={(e) => change('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="VAT / PAN Number">
              <input
                value={value.pan}
                onChange={(e) => change('pan', e.target.value)}
                placeholder="e.g. 600123456"
                maxLength={30}
              />
            </Field>
          </div>
          <Field label="Address">
            <textarea
              rows={2}
              value={value.address}
              onChange={(e) => change('address', e.target.value)}
              placeholder="Street, city, Nepal"
              maxLength={500}
            />
          </Field>
          <div className="form-grid">
            <Field label="Email Address" error={errors.email}>
              <input
                type="email"
                value={value.email}
                onChange={(e) => change('email', e.target.value)}
                placeholder="name@company.com"
              />
            </Field>
            <Field label="Phone Number">
              <input
                type="tel"
                value={value.phone}
                onChange={(e) => change('phone', e.target.value)}
                placeholder="+977"
                maxLength={40}
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Contact Person" hint="The person representing this company.">
              <input
                value={value.contactName || ''}
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
                value={value.contactEmail || ''}
                maxLength={254}
                placeholder="asha@company.com"
                onChange={(e) => change('contactEmail', e.target.value)}
              />
            </Field>
          </div>
          <ErrorText>{errors.form}</ErrorText>
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy && <Spinner />}Create & Select Customer
          </button>
        </div>
      </form>
    </Modal>
  );
}
