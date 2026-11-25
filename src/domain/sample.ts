import { emptyWorkspace } from './defaults';
import { addDays, today } from './quotation';
import { nepaliFiscalYear } from './sequence';
import type { Customer, Workspace } from './types';
export function sampleWorkspace(name: string): Workspace {
  const w = emptyWorkspace(name);
  const date = today();
  w.company = {
    ...w.company,
    address: 'Lazimpat, Kathmandu, Nepal',
    phone: '+977 01 4521800',
    email: 'hello@example.com',
    pan: '000000000',
  };
  w.customers = [
    {
      id: crypto.randomUUID(),
      name: 'Everest Business Solutions',
      category: 'Enterprise',
      address: 'New Baneshwor, Kathmandu',
      email: 'procurement@example.com',
      phone: '+977 01 4101200',
      pan: '000000001',
      photo: '',
    },
    {
      id: crypto.randomUUID(),
      name: 'Valley Development Bank',
      category: 'Banking',
      address: 'Pulchowk, Lalitpur',
      email: 'office@example.com',
      phone: '+977 01 5521800',
      pan: '000000002',
      photo: '',
    },
    {
      id: crypto.randomUUID(),
      name: 'Municipal Planning Office',
      category: 'Government',
      address: 'Bhaktapur, Nepal',
      email: 'planning@example.com',
      phone: '+977 01 6611200',
      pan: '000000003',
      photo: '',
    },
    {
      id: crypto.randomUUID(),
      name: 'Himalayan Assurance',
      category: 'Insurance',
      address: 'Kamaladi, Kathmandu',
      email: 'admin@example.com',
      phone: '+977 01 4221800',
      pan: '000000004',
      photo: '',
    },
  ] as Customer[];
  w.quotations = w.customers.slice(0, 3).map((customer, i) => ({
    id: crypto.randomUUID(),
    number: `ANV/${nepaliFiscalYear(addDays(date, -i * 3))}/${String(i + 1).padStart(3, '0')}`,
    date: addDays(date, -i * 3),
    validUntil: addDays(date, 30 - i * 3),
    status: i === 0 ? 'Sent' : i === 1 ? 'Accepted' : 'Valid',
    customer: { ...customer },
    company: { ...w.company },
    items: [
      {
        id: crypto.randomUUID(),
        description: [
          'Office workstation setup and installation',
          'Annual network maintenance service',
          'Office equipment supply',
        ][i],
        quantity: [5, 1, 12][i],
        unitPrice: [18500, 95000, 6200][i],
      },
    ],
    discount: 0,
    vatEnabled: true,
    terms: w.company.terms,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    layout: { design: 'classic', logoWidth: 132 },
  }));
  w.nextNumber = 4;
  w.sequenceYear = nepaliFiscalYear(date);
  return w;
}
