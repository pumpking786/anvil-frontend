import { useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';
import { Field, ImageUpload } from './ui';
import type { EmailTemplate } from '../domain/types';
export type EmailDraft = Omit<EmailTemplate, 'id' | 'name'>;
export function EmailContentEditor({
  value,
  onChange,
}: {
  value: EmailDraft;
  onChange: (value: EmailDraft) => void;
}) {
  const message = useRef<HTMLTextAreaElement>(null);
  const signature = useRef<HTMLTextAreaElement>(null);
  function toolbar(key: 'message' | 'signature', ref: React.RefObject<HTMLTextAreaElement | null>) {
    function mark(before: string, after: string) {
      const field = ref.current;
      if (!field) return;
      const start = field.selectionStart,
        end = field.selectionEnd;
      onChange({
        ...value,
        [key]:
          value[key].slice(0, start) +
          before +
          (value[key].slice(start, end) || 'text') +
          after +
          value[key].slice(end),
      });
      field.focus();
    }
    return (
      <div className="email-format-toolbar" role="group" aria-label={`${key} formatting`}>
        <button
          type="button"
          className="icon-button"
          title="Bold"
          aria-label={`Bold ${key}`}
          onClick={() => mark('**', '**')}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Italic"
          aria-label={`Italic ${key}`}
          onClick={() => mark('*', '*')}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Bullet"
          aria-label={`Bullet in ${key}`}
          onClick={() => mark('\n- ', '')}
        >
          <List size={15} />
        </button>
        <small>Select text to format it. Remove the marks for normal text.</small>
      </div>
    );
  }
  return (
    <>
      <Field label="Email Subject">
        <input
          required
          maxLength={160}
          value={value.subject}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
        />
      </Field>
      <Field
        label="Email Message"
        hint="Reusable fields: {{customer}} or {{contact}} for the recipient's name, {{customerCompany}}, {{quotation}}, {{company}}, {{phone}}, {{sender}}, {{senderEmail}}."
      >
        <textarea
          required
          ref={message}
          rows={7}
          maxLength={10000}
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
      </Field>
      {toolbar('message', message)}
      <Field label="Email Signature">
        <textarea
          ref={signature}
          rows={3}
          maxLength={3000}
          value={value.signature}
          onChange={(e) => onChange({ ...value, signature: e.target.value })}
        />
      </Field>
      {toolbar('signature', signature)}
      <div className="form-grid">
        <Field label="Font">
          <select
            value={value.font}
            onChange={(e) => onChange({ ...value, font: e.target.value as EmailDraft['font'] })}
          >
            {['Arial', 'Georgia', 'Verdana'].map((font) => (
              <option key={font}>{font}</option>
            ))}
          </select>
        </Field>
        <Field label="Text Alignment">
          <select
            value={value.align}
            onChange={(e) => onChange({ ...value, align: e.target.value as EmailDraft['align'] })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Field>
        <Field label="Text Color">
          <input
            type="color"
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
          />
        </Field>
      </div>
      <ImageUpload
        label="Signature Image Or Logo"
        value={value.logo}
        onChange={(logo) => onChange({ ...value, logo })}
      />
    </>
  );
}
