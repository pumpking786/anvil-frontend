import { EmailPreview } from './EmailPreview';
import { useEffect, useRef, useState } from 'react';
import { Mail, Plus, Save, Trash2, CheckCircle2 } from 'lucide-react';
import type { EmailTemplate, WorkspaceUser } from '../domain/types';
import {
  defaultEmailDraft,
  preferredTemplate,
  templateContent,
  expandEmailContent,
} from '../lib/emailTemplates';
import { EmailContentEditor } from './EmailContentEditor';
import { ErrorText, Field, Spinner } from './ui';
export type EmailPreferences = Pick<WorkspaceUser, 'emailTemplates' | 'defaultEmailTemplateId'>;
export function ProfileEmailTemplates({
  user,
  onSave,
  onDirty,
}: {
  user: WorkspaceUser;
  onSave: (value: EmailPreferences) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const initial = preferredTemplate(user);
  const [selected, setSelected] = useState(initial?.id || '');
  const [name, setName] = useState(initial?.name || 'My quotation');
  const [draft, setDraft] = useState(templateContent(initial));
  const [isDefault, setIsDefault] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const templates = user.emailTemplates || [];
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  function choose(id: string) {
    if (dirty && !confirm('Discard unsaved email template changes?')) return;
    const item = templates.find((value) => value.id === id);
    setSelected(item?.id || '');
    setName(item?.name || 'New quotation template');
    setDraft(templateContent(item));
    setIsDefault(!templates.length || preferredTemplate(user)?.id === id);
    setDirty(false);
    setError('');
    setNotice('');
  }
  async function save(remove = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(remove ? 'delete' : 'save');
    setError('');
    setNotice('');
    try {
      if (!remove && (!name.trim() || !draft.subject.trim() || !draft.message.trim()))
        throw new Error('Enter a template name, subject and email message.');
      const id = selected || crypto.randomUUID();
      const template: EmailTemplate = { ...draft, id, name: name.trim() };
      const next = remove
        ? templates.filter((item) => item.id !== selected)
        : templates.some((item) => item.id === id)
          ? templates.map((item) => (item.id === id ? template : item))
          : [...templates, template];
      if (next.length > 20)
        throw new Error('You can save up to 20 templates. Remove an unused template first.');
      const defaultId =
        remove && preferredTemplate(user)?.id === selected
          ? next[0]?.id
          : isDefault && !remove
            ? id
            : preferredTemplate(user)?.id || next[0]?.id;
      await onSave({ emailTemplates: next, defaultEmailTemplateId: defaultId });
      const active = remove ? next.find((item) => item.id === defaultId) || next[0] : template;
      setSelected(active?.id || '');
      setName(active?.name || 'My quotation');
      setDraft(active ? templateContent(active) : defaultEmailDraft());
      setIsDefault(active?.id === defaultId);
      setDirty(false);
      setNotice(
        remove
          ? 'Template removed from your profile.'
          : 'Your quotation content and signature are saved.',
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  const preview = expandEmailContent(draft, {
    customer: 'Contact person',
    contact: 'Contact person',
    customerCompany: 'Customer company',
    quotation: 'ANV/83-84/001',
    company: 'Your company',
    phone: 'Your company phone',
    sender: user.name,
    senderEmail: user.email,
  });
  return (
    <section className="panel profile-email-templates">
      <div className="panel-heading">
        <h2>
          <Mail size={18} />
          Email Templates & Signature
        </h2>
        <span className="mini-tag">PERSONAL</span>
      </div>
      <form
        className="panel-body"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="section-description">
          Manage your quotation email content and signature here. Your default template opens
          automatically when you email a quotation. Sender: <strong>{user.email}</strong>.
        </p>
        <fieldset className="email-fields" disabled={!!busy}>
          <div className="form-grid">
            <Field label="Your Email Templates">
              <select value={selected} onChange={(event) => choose(event.target.value)}>
                <option value="">New template</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {preferredTemplate(user)?.id === item.id ? ' · Default' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Template Name">
              <input
                required
                maxLength={80}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setDirty(true);
                }}
              />
            </Field>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={isDefault}
              disabled={!!selected && preferredTemplate(user)?.id === selected}
              onChange={(event) => {
                setIsDefault(event.target.checked);
                setDirty(true);
              }}
            />
            Use As My Default Quotation Email
          </label>
          <EmailContentEditor
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setDirty(true);
              setNotice('');
            }}
          />
          <details className="email-preview" open>
            <summary>Preview With Sample Quotation Details</summary>
            <EmailPreview content={preview} />
          </details>
        </fieldset>
        <ErrorText>{error}</ErrorText>
        {notice && (
          <p className="email-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}
        <div className="connection-actions">
          <button className="button primary" disabled={!!busy || (!dirty && !!selected)}>
            {busy === 'save' ? <Spinner /> : <Save size={16} />}Save Template & Signature
          </button>
          <button
            type="button"
            className="button"
            disabled={!!busy || templates.length >= 20}
            onClick={() => choose('')}
          >
            <Plus size={16} />
            New Template
          </button>
          {selected && (
            <button
              type="button"
              className="button danger-button"
              disabled={!!busy}
              onClick={() => {
                if (confirm('Delete this saved email template?')) void save(true);
              }}
            >
              {busy === 'delete' ? <Spinner /> : <Trash2 size={16} />}Delete
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
