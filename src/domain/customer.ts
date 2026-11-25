import type { Workspace } from './types';
export function removeCustomer(workspace: Workspace, id: string): Workspace {
  return {
    ...workspace,
    customers: workspace.customers.filter((customer) => customer.id !== id),
    leads: workspace.leads.map((lead) =>
      lead.customerId === id ? { ...lead, customerId: '' } : lead,
    ),
  };
}
