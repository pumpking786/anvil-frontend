import type { Quotation, WorkspaceUser } from './types';

// Snapshot the creator's display name so later logins/profile edits cannot relabel a document.
// Older quotations acquire attribution when an authenticated user next prepares them.
export function withQuotationPreparer(
  quote: Quotation,
  user: Pick<WorkspaceUser, 'id' | 'name'>,
): Quotation {
  return quote.preparedBy
    ? quote
    : {
        ...quote,
        preparedBy: { userId: user.id, name: user.name.trim() },
      };
}
