import { calculateTotals, toPaisa } from './quotation';
import type { Quotation, Workspace } from './types';

export const QUOTATION_STATUSES = [
  'Valid',
  'Sent',
  'Accepted',
  'Cancelled',
  'Draft',
  'Expired',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export function quotationStatus(
  quote: Pick<Quotation, 'status' | 'validUntil'>,
  date: string,
): QuotationStatus {
  const status = quote.status || 'Valid';
  return ['Valid', 'Sent'].includes(status) && quote.validUntil < date ? 'Expired' : status;
}

export function dashboardMetrics(workspace: Workspace, date: string, monthCount: 6 | 12) {
  const [year, month] = date.split('-').map(Number);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const start = new Date(Date.UTC(year, month - monthCount + index, 1));
    return {
      key: start.toISOString().slice(0, 7),
      label: start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      fullLabel: start.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      quoted: 0,
      accepted: 0,
      count: 0,
    };
  });
  const periodQuotes = workspace.quotations.filter(
    (q) => q.date >= `${months[0].key}-01` && q.date <= date,
  );
  const counts = Object.fromEntries(QUOTATION_STATUSES.map((status) => [status, 0])) as Record<
    QuotationStatus,
    number
  >;
  let accepted = 0,
    issued = 0,
    open = 0;
  for (const quote of periodQuotes) {
    const status = quotationStatus(quote, date);
    const amount = toPaisa(
      calculateTotals(quote.items, quote.discount, quote.vatEnabled, quote.vatRate).total,
    );
    const bucket = months.find((item) => item.key === quote.date.slice(0, 7))!;
    counts[status]++;
    bucket.count++;
    if (!['Draft', 'Cancelled'].includes(status)) {
      issued += amount;
      bucket.quoted += amount;
    }
    if (status === 'Accepted') {
      accepted += amount;
      bucket.accepted += amount;
    }
    if (status === 'Valid' || status === 'Sent') open += amount;
  }
  const closed = counts.Accepted + counts.Cancelled;
  return {
    months: months.map((item) => ({
      ...item,
      quoted: item.quoted / 100,
      accepted: item.accepted / 100,
    })),
    counts,
    quoteCount: periodQuotes.length,
    issued: issued / 100,
    accepted: accepted / 100,
    open: open / 100,
    winRate: closed ? Math.round((counts.Accepted / closed) * 100) : null,
    recent: [...periodQuotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
  };
}
