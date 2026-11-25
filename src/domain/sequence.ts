import type { Workspace } from './types';
import NepaliDate from 'nepali-date-converter';

/** Nepal's fiscal year starts on Shrawan 1; the converter accounts for the Gregorian boundary shifting by date. */
export function nepaliFiscalYear(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const nepali = NepaliDate.fromAD(new Date(year, month - 1, day, 12));
  const startYear = nepali.getYear() - (nepali.getMonth() < 3 ? 1 : 0);
  const start = String(startYear % 100).padStart(2, '0');
  const end = String((startYear + 1) % 100).padStart(2, '0');
  return `${start}-${end}`;
}

function codeFor(workspace: { settings?: { quotePrefix?: string } }) {
  return (workspace.settings?.quotePrefix || 'ANV').trim().toUpperCase();
}

export function fiscalYearFor(
  workspace: { settings?: { fiscalYearOverride?: string; fiscalYearOverrideFor?: string } },
  date: string,
) {
  const actual = nepaliFiscalYear(date);
  const override = workspace.settings?.fiscalYearOverride?.trim();
  return override && workspace.settings?.fiscalYearOverrideFor === actual ? override : actual;
}

function sequenceInNumber(number: string, code: string, fiscalYear: string) {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${escaped}/${fiscalYear}/(\\d+)$`, 'i').exec(number.trim());
  return match ? Number(match[1]) : 0;
}

function startForFiscalYear(
  workspace: Pick<Workspace, 'nextNumber' | 'sequenceYear' | 'quotations'> &
    Partial<Pick<Workspace, 'settings'>>,
  fiscalYear: string,
) {
  if (workspace.sequenceYear === fiscalYear) return workspace.nextNumber;
  const code = codeFor(workspace);
  return (
    Math.max(
      0,
      ...workspace.quotations.map((quote) => sequenceInNumber(quote.number, code, fiscalYear)),
    ) + 1
  );
}

export function nextQuotationNumber(
  workspace: Pick<Workspace, 'nextNumber' | 'quotations'> &
    Partial<Pick<Workspace, 'settings' | 'sequenceYear'>>,
  date: string,
) {
  const fiscalYear = fiscalYearFor(workspace, date);
  const sequenceYear = workspace.sequenceYear || '';
  let sequence = startForFiscalYear({ ...workspace, sequenceYear }, fiscalYear);
  const code = codeFor(workspace);
  const used = new Set(workspace.quotations.map((quote) => quote.number.trim().toLowerCase()));
  let number = `${code}/${fiscalYear}/${String(sequence).padStart(3, '0')}`;
  while (used.has(number.toLowerCase())) {
    sequence++;
    number = `${code}/${fiscalYear}/${String(sequence).padStart(3, '0')}`;
  }
  return number;
}

export function sequenceAfterSave(
  workspace: Pick<Workspace, 'nextNumber' | 'quotations'> &
    Partial<Pick<Workspace, 'settings' | 'sequenceYear'>>,
  number: string,
  date: string,
  isNew: boolean,
) {
  if (!isNew)
    return { nextNumber: workspace.nextNumber, sequenceYear: workspace.sequenceYear || '' };
  const fiscalYear = fiscalYearFor(workspace, date);
  const code = codeFor(workspace);
  const start = startForFiscalYear(
    { ...workspace, sequenceYear: workspace.sequenceYear || '' },
    fiscalYear,
  );
  const customSequence = sequenceInNumber(number, code, fiscalYear);
  return {
    nextNumber: Math.max(start + (customSequence ? 0 : 1), customSequence + 1),
    sequenceYear: fiscalYear,
  };
}
