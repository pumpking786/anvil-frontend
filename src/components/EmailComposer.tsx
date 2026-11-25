import { EmailPreview } from './EmailPreview';
import {
  preferredTemplate,
  templateContent,
  expandEmailContent,
  emailRecipient,
} from '../lib/emailTemplates';
import { parseEmailRecipients } from '../lib/emailRecipients';
import type { EmailDraft } from './EmailContentEditor';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Send } from 'lucide-react';
import type { Connection, Customer, Quotation, WorkspaceUser } from '../domain/types';
import { blobBase64, EmailApi, type EmailReceipt } from '../lib/email';
import { downloadQuotation, generateQuotationPdf, quotationFilename } from '../pdf/download';
import { ErrorText, Field, Modal, Spinner } from './ui';
export function EmailComposer({
  quote,
  connection,
  onClose,
  onSent,
  user,
  currentCustomer,
}: {
  quote: Quotation;
  connection: Connection;
  onClose: () => void;
  onSent: (receipt: EmailReceipt) => Promise<void>;
  user: WorkspaceUser;
  currentCustomer?: Customer;
}) {
  const recipient = emailRecipient(quote.customer, currentCustomer);
  const [to, setTo] = useState(recipient.email);
  const [contactName, setContactName] = useState(recipient.name);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const templates = user.emailTemplates || [];
  const [selected, setSelected] = useState(preferredTemplate(user)?.id || '');
  const lock = useRef(false);
  const [draft, setDraft] = useState<EmailDraft>(() => templateContent(preferredTemplate(user)));
  const content = expandEmailContent(draft, {
    customer: contactName.trim() || recipient.company,
    contact: contactName.trim() || recipient.company,
    customerCompany: recipient.company,
    quotation: quote.number,
    company: quote.company.name,
    phone: quote.company.phone,
    sender: user.name,
    senderEmail: user.email,
  });
  const [recipientErrors, setRecipientErrors] = useState<Record<string, string>>({});
  function validateRecipient(value: string, field: 'To' | 'CC' | 'BCC') {
    try {
      parseEmailRecipients(value, field);
      setRecipientErrors((errors) => ({ ...errors, [field]: '' }));
    } catch (cause) {
      setRecipientErrors((errors) => ({ ...errors, [field]: (cause as Error).message }));
    }
  }
  const [ready, setReady] = useState(false);
  const [sender, setSender] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [defaultBcc, setDefaultBcc] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'load' | 'prepare' | 'send' | 'save' | 'preview'>('load');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<EmailReceipt | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const pdf = useRef('');
  const controller = useRef(new AbortController());
  const submitting = busy === 'send' || busy === 'save';
  const progress = {
    load: 'Checking email delivery…',
    prepare: 'Preparing your PDF attachment. Your email has not been sent yet.',
    preview: 'Preparing the PDF preview…',
    send: 'Submitting your quotation to the mail server. Please keep this window open.',
    save: 'Email sent. Updating the quotation status…',
  };
  function close() {
    if (submitting) return;
    controller.current.abort();
    onClose();
  }
  useEffect(() => {
    controller.current = new AbortController();
    let active = true;
    new EmailApi(connection)
      .status()
      .then((s) => {
        if (!active) return;
        setDefaultBcc(s.defaultBcc || []);
        setSender(`${s.fromName} <${s.fromEmail}>`);
        setReplyTo(s.replyTo && s.replyTo !== s.fromEmail ? s.replyTo : '');
        if (!s.ready) {
          const nextStep: Record<string, string> = {
            mailbox_reconnect:
              'Your mailbox authorization needs attention. Reconnect it in Settings → Sending mailbox.',
            smtp_verify:
              'The installation owner must verify the SMTP connection in Owner Portal → Connections & delivery.',
            smtp_sender:
              'The installation owner must enter the sending email address in the SMTP settings.',
            not_configured:
              'Ask the installation owner to configure SMTP in the backend environment or enable Google/Microsoft mailbox authorization in the Owner Portal.',
            resend_verify:
              'The installation owner must verify the Resend sending domain in the Owner Portal.',
            resend_domain: `Resend is not approved to send from ${s.fromEmail}. Ask the installation owner to authorize its exact domain.`,
          };
          throw new Error(
            nextStep[s.reason || ''] ||
              'Email delivery is unavailable for your account. Ask the installation owner to check the email connection.',
          );
        }
        setReady(true);
        setSender(`${s.fromName} <${s.fromEmail}>`);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
      controller.current.abort();
    };
  }, []);
  function edit(action: () => void) {
    action();
    requestId.current = crypto.randomUUID();
    setError('');
    setRecipientErrors({});
  }
  async function send() {
    if (lock.current || busy || receipt) return;
    const addresses: Record<string, string[]> = {};
    const errors: Record<string, string> = {};
    for (const [field, value] of [
      ['To', to],
      ['CC', cc],
      ['BCC', bcc],
    ] as const) {
      try {
        addresses[field] = parseEmailRecipients(value, field);
      } catch (cause) {
        errors[field] = (cause as Error).message;
      }
    }
    setRecipientErrors(errors);
    if (Object.keys(errors).length) return;
    lock.current = true;
    setBusy('prepare');
    setError('');
    const signal = controller.current.signal;
    try {
      if (!pdf.current)
        pdf.current = await blobBase64(await generateQuotationPdf(quote, signal), signal);
      // Closing during preparation must never submit an email afterward.
      signal.throwIfAborted();
      setBusy('send');
      const result = await new EmailApi(connection).send({
        idempotencyKey: requestId.current,
        quotationId: quote.id,
        quotationNumber: quote.number,
        customerId: quote.customer.id,
        customerName: quote.customer.name,
        to: addresses.To,
        cc: addresses.CC,
        bcc: addresses.BCC,
        ...content,
        subject: content.subject.trim(),
        message: content.message.trim(),
        filename: quotationFilename(quote),
        pdf: pdf.current,
      });
      setReceipt(result);
      window.dispatchEvent(new Event('patra-email-sent'));
      try {
        setBusy('save');
        await onSent(result);
      } catch {
        setError(
          'The mail server accepted this email, but the quotation status could not be saved. Update it from the quotation list; do not send again.',
        );
      }
    } catch (e) {
      if (!signal.aborted) setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  return (
    <Modal
      title={
        receipt
          ? receipt.partial
            ? 'Quotation Partially Sent'
            : 'Quotation Sent Successfully!'
          : 'Email Quotation'
      }
      subtitle={quote.number}
      className="email-composer"
      onClose={close}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="email-compose-body">
          {receipt ? (
            <div className="email-success">
              <CheckCircle2 size={34} />
              <h3>
                {receipt.partial
                  ? 'Some Recipients Need Attention'
                  : 'Thank You For The Opportunity'}
              </h3>
              <p>
                {receipt.partial
                  ? 'Your quotation was submitted to the recipients accepted by your email provider.'
                  : 'Your quotation has been successfully submitted to the customer. We appreciate the opportunity to present our proposal and look forward to the possibility of working together.'}
              </p>
              {receipt.partial && (
                <ErrorText>
                  Some recipients were rejected by the mail server. Check its sent log before
                  resending.
                </ErrorText>
              )}
              <small>
                {new Date(receipt.acceptedAt).toLocaleString('en-GB', {
                  timeZone: 'Asia/Kathmandu',
                })}
              </small>
            </div>
          ) : (
            <>
              {sender && (
                <p className="email-from">
                  From <strong>{sender}</strong>
                </p>
              )}
              {replyTo && <p className="field-hint">Customer replies go to {replyTo}.</p>}
              <fieldset className="email-fields" disabled={!!busy}>
                <Field
                  label="Contact Person"
                  hint="The email greeting uses this name. Saved templates update in the preview below."
                >
                  <input
                    value={contactName}
                    maxLength={150}
                    onChange={(e) => edit(() => setContactName(e.target.value))}
                  />
                </Field>
                <Field
                  label="To Contact Email"
                  hint="Separate addresses with ; — up to 20 recipients. Everyone in To can see the other To addresses."
                  error={recipientErrors.To}
                >
                  <textarea
                    required
                    rows={2}
                    maxLength={6000}
                    inputMode="email"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="asha@company.com; ram@company.com; team@company.com"
                    value={to}
                    onChange={(e) => edit(() => setTo(e.target.value))}
                    onBlur={() => validateRecipient(to, 'To')}
                  />
                </Field>
                <div className="form-grid">
                  <Field
                    label="CC"
                    hint="Separate addresses with semicolons (;)."
                    error={recipientErrors.CC}
                  >
                    <input
                      value={cc}
                      onChange={(e) => edit(() => setCc(e.target.value))}
                      onBlur={() => validateRecipient(cc, 'CC')}
                    />
                  </Field>
                  <Field
                    label="Additional BCC"
                    hint="Hidden from other recipients. Separate addresses with semicolons (;)."
                    error={recipientErrors.BCC}
                  >
                    <input
                      value={bcc}
                      onChange={(e) => edit(() => setBcc(e.target.value))}
                      onBlur={() => validateRecipient(bcc, 'BCC')}
                    />
                  </Field>
                </div>
                {defaultBcc.length > 0 && (
                  <div className="email-default-bcc" role="note">
                    <strong>Default BCC · Added Automatically</strong>
                    <p>{defaultBcc.join(', ')}</p>
                    <small>Managed by your administrator. Hidden from To and CC recipients.</small>
                  </div>
                )}
                <div className="email-template-panel">
                  <Field label="Saved Email Template">
                    <select
                      value={selected}
                      onChange={(e) =>
                        edit(() => {
                          setSelected(e.target.value);
                          const template = templates.find((t) => t.id === e.target.value);
                          setDraft(templateContent(template));
                        })
                      }
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!templates.length && (
                    <p className="field-hint">
                      No email templates yet. Create one in My Profile to use it here.
                    </p>
                  )}
                </div>
              </fieldset>
              <details className="email-preview" open>
                <summary>Email Preview</summary>
                <div className="email-preview-subject">
                  <strong>Subject:</strong> {content.subject}
                </div>
                <EmailPreview content={content} />
              </details>
              <div className="email-attachment">
                <FileText size={22} />
                <div>
                  <strong>{quotationFilename(quote)}</strong>
                  <small>A4 quotation · PDF attachment</small>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Preview Email Attachment"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy('preview');
                    try {
                      await downloadQuotation(quote, controller.current.signal);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy('');
                    }
                  }}
                >
                  <Download size={17} />
                </button>
              </div>
            </>
          )}
          {busy && (
            <p className="operation-status" role="status" aria-live="polite">
              <Spinner /> {progress[busy]}
            </p>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" disabled={submitting} onClick={close}>
            {receipt
              ? 'Done'
              : busy === 'prepare' || busy === 'preview'
                ? 'Cancel Preparation'
                : 'Cancel'}
          </button>
          {!receipt && (
            <button className="button primary" disabled={!ready || !!busy}>
              {busy ? <Spinner /> : <Send size={16} />}{' '}
              {busy === 'prepare'
                ? 'Preparing PDF…'
                : busy === 'send'
                  ? 'Sending Quotation…'
                  : 'Send Quotation'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
