import type { Customer, Lead, LeadActivity, LeadStage, WorkspaceUser } from './types';
import { today } from './quotation';

export const LEAD_STAGES: LeadStage[] = ['New', 'Qualified', 'Proposal', 'Won', 'Lost'];
export const STAGE_PROBABILITY: Record<LeadStage, number> = {
  New: 10,
  Qualified: 35,
  Proposal: 70,
  Won: 100,
  Lost: 0,
};
export const isOpenLead = (lead: Lead) => !['Won', 'Lost'].includes(lead.stage);
export const leadProbability = (lead: Lead) =>
  isOpenLead(lead)
    ? (lead.probability ?? STAGE_PROBABILITY[lead.stage])
    : STAGE_PROBABILITY[lead.stage];
export function normalizeLead(lead: Lead): Lead {
  return {
    ownerId: '',
    priority: 'Normal',
    expectedClose: '',
    lostReason: '',
    customerId: '',
    address: '',
    activities: [],
    history: [],
    ...lead,
    probability: leadProbability(lead),
  };
}
export function newLead(user: WorkspaceUser): Lead {
  return normalizeLead({
    id: crypto.randomUUID(),
    name: '',
    company: '',
    email: '',
    phone: '',
    source: '',
    stage: 'New',
    expectedValue: 0,
    nextAction: '',
    notes: '',
    ownerId: user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
export function leadErrors(lead: Lead) {
  const errors: Record<string, string> = {};
  if (!lead.name.trim()) errors.name = 'Enter a contact name.';
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim()))
    errors.email = 'Enter a valid email address.';
  if (
    !Number.isFinite(lead.expectedValue) ||
    lead.expectedValue < 0 ||
    lead.expectedValue > 999_999_999.99
  )
    errors.expectedValue = 'Enter a value between 0 and 999,999,999.99.';
  if (!Number.isFinite(lead.probability) || lead.probability! < 0 || lead.probability! > 100)
    errors.probability = 'Enter a probability from 0 to 100.';
  if (lead.stage === 'Lost' && !lead.lostReason?.trim())
    errors.lostReason = 'Record why this opportunity was lost.';
  if (lead.expectedClose && !validCrmDate(lead.expectedClose))
    errors.expectedClose = 'Enter a valid close date.';
  return errors;
}
export function validCrmDate(value: string) {
  const date = new Date(value + 'T12:00:00Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function nextLeadActivity(lead: Lead) {
  return [...(lead.activities || [])]
    .filter((activity) => activity.status === 'Planned')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}
export function activityDue(activity: LeadActivity, date = today()) {
  return activity.status === 'Done'
    ? 'Done'
    : activity.dueDate < date
      ? 'Overdue'
      : activity.dueDate === date
        ? 'Today'
        : 'Upcoming';
}
export function crmMetrics(leads: Lead[], date = today()) {
  const open = leads.filter(isOpenLead);
  const won = leads.filter((lead) => lead.stage === 'Won').length;
  const closed = leads.filter((lead) => !isOpenLead(lead)).length;
  return {
    openCount: open.length,
    pipeline: open.reduce((sum, lead) => sum + lead.expectedValue, 0),
    weighted:
      Math.round(
        open.reduce((sum, lead) => sum + (lead.expectedValue * leadProbability(lead)) / 100, 0) *
          100,
      ) / 100,
    overdue: open.reduce(
      (sum, lead) =>
        sum +
        (lead.activities || []).filter((activity) => activityDue(activity, date) === 'Overdue')
          .length,
      0,
    ),
    winRate: closed ? Math.round((won / closed) * 100) : null,
    won,
  };
}
export function recordLeadChange(lead: Lead, userName: string, message: string): Lead {
  const at = new Date().toISOString();
  return {
    ...lead,
    updatedAt: at,
    history: [
      { id: crypto.randomUUID(), at, by: userName, message },
      ...(lead.history || []),
    ].slice(0, 200),
  };
}
export function customerForLead(lead: Lead, customers: Customer[]) {
  const linked = customers.find((customer) => customer.id === lead.customerId);
  if (linked) return linked;
  const email = lead.email.trim().toLowerCase();
  return email
    ? customers.find(
        (customer) =>
          customer.email.trim().toLowerCase() === email ||
          customer.contactEmail?.trim().toLowerCase() === email,
      )
    : undefined;
}
export function customerFromLead(lead: Lead): Customer {
  return {
    id: crypto.randomUUID(),
    name: lead.company.trim() || lead.name.trim(),
    email: lead.email.trim(),
    contactName: lead.company.trim() ? lead.name.trim() : '',
    contactEmail: lead.company.trim() ? lead.email.trim() : '',
    phone: lead.phone.trim(),
    address: lead.address || '',
    pan: '',
    category: 'Enterprise',
    photo: '',
  };
}
