import type { Customer, EmailTemplate, WorkspaceUser } from '../domain/types';
export function emailRecipient(snapshot: Customer, current?: Customer) {
  const customer = current?.id === snapshot.id ? current : snapshot;
  return {
    name: customer.contactName?.trim() || customer.name.trim(),
    email: customer.contactEmail?.trim() || customer.email.trim(),
    company: customer.name,
  };
}
export type EmailDraft = Omit<EmailTemplate, 'id' | 'name'>;
export function defaultEmailDraft(): EmailDraft {
  return {
    subject: 'Quotation {{quotation}} · {{company}}',
    message:
      'Dear {{customer}},\n\nPlease find attached quotation {{quotation}} for your review. Let us know if you have any questions or would like to proceed.',
    signature: 'Regards,\n{{sender}}\n{{senderEmail}}\n{{company}}\n#ForgingITExcellence',
    logo: '',
    color: '#243247',
    align: 'left',
    font: 'Arial',
  };
}
export function preferredTemplate(user: WorkspaceUser) {
  return (
    user.emailTemplates?.find((item) => item.id === user.defaultEmailTemplateId) ||
    user.emailTemplates?.[0]
  );
}
export function templateContent(template?: EmailTemplate): EmailDraft {
  if (!template) return defaultEmailDraft();
  const { id: _id, name: _name, ...content } = template;
  return content;
}
export function expandEmailContent(draft: EmailDraft, values: Record<string, string>): EmailDraft {
  const expand = (value: string) =>
    value.replace(
      /\{\{(customer|contact|customerCompany|quotation|company|phone|sender|senderEmail)\}\}/g,
      (match, key: string) => values[key] ?? match,
    );
  return {
    ...draft,
    subject: expand(draft.subject),
    message: expand(draft.message),
    signature: expand(draft.signature),
  };
}
