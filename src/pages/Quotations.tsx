import { useUiState } from '../lib/uiState';
import { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Quotation, Workspace } from '../domain/types';
import { calculateTotals, formatDate, money, today } from '../domain/quotation';
import { CreatedDate } from '../components/CreatedDate';
import { Avatar } from '../components/ui';
export function Quotations({
  workspace,
  onOpen,
  onDelete,
}: {
  workspace: Workspace;
  onOpen: (q?: Quotation) => void;
  onDelete: (q: Quotation) => void;
}) {
  const [search, setSearch] = useUiState('Quotations.search', '');
  const [filter, setFilter] = useUiState('Quotations.filter', 'All statuses');
  const current = today();
  const quotes = useMemo(
    () =>
      [...workspace.quotations]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .filter(
          (q) =>
            `${q.number} ${q.customer.name}`.toLowerCase().includes(search.toLowerCase()) &&
            (filter === 'All statuses' ||
              (() => {
                const effective =
                  q.validUntil < current && ['Valid', 'Sent'].includes(q.status || 'Valid')
                    ? 'Expired'
                    : q.status || 'Valid';
                return effective === filter;
              })()),
        ),
    [workspace.quotations, search, filter, current],
  );
  const value = workspace.quotations.reduce(
    (sum, q) => sum + calculateTotals(q.items, q.discount, q.vatEnabled, q.vatRate).total,
    0,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREPARED WITH CARE</span>
          <h1>Quotations</h1>
          <p>From a first conversation to your next opportunity.</p>
        </div>
        <button className="button primary" onClick={() => onOpen()}>
          <Plus size={17} />
          New Quotation
        </button>
      </div>
      <div className="overview-strip">
        <div>
          <span>
            Total quotation value <span className="tiny-label">NPR</span>
          </span>
          <strong>
            {money(value)}
            <span className="overview-icon">
              <ArrowUpRight size={21} />
            </span>
          </strong>
          <small>Across all saved quotations</small>
        </div>
        <div>
          <span>Quotations prepared</span>
          <strong>
            {String(workspace.quotations.length).padStart(2, '0')}
            <span className="overview-icon">
              <FileText size={20} />
            </span>
          </strong>
          <small>Every detail in one place</small>
        </div>
        <div>
          <span>Within validity</span>
          <strong>
            {String(
              workspace.quotations.filter(
                (q) => q.validUntil >= current && ['Valid', 'Sent'].includes(q.status),
              ).length,
            ).padStart(2, '0')}
            <span className="overview-icon">
              <CalendarDays size={20} />
            </span>
          </strong>
          <small>Ready for your customer’s decision</small>
        </div>
      </div>
      <div className="quotation-status-chart" aria-label="Quotation Status Metrics">
        {['Valid', 'Sent', 'Accepted', 'Cancelled', 'Draft', 'Expired'].map((status) => {
          const count = workspace.quotations.filter((q) => {
            const effective =
              q.validUntil < current && ['Valid', 'Sent'].includes(q.status || 'Valid')
                ? 'Expired'
                : q.status || 'Valid';
            return effective === status;
          }).length;
          const width = workspace.quotations.length
            ? (count / workspace.quotations.length) * 100
            : 0;
          return (
            <button
              type="button"
              className={`quotation-status-metric status-${status.toLowerCase()}`}
              key={status}
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              <span>{status}</span>
              <strong>{count}</strong>
              <i aria-hidden="true">
                <b style={{ width: `${width}%` }} />
              </i>
            </button>
          );
        })}
      </div>
      <section className="quotation-list">
        <div className="list-top">
          <div className="tabs">
            {['All statuses', 'Valid', 'Sent', 'Accepted', 'Cancelled', 'Draft', 'Expired'].map(
              (tab) => (
                <button
                  key={tab === 'All statuses' ? 'All Statuses' : tab}
                  className={filter === tab ? 'active' : ''}
                  onClick={() => setFilter(tab)}
                >
                  {tab === 'All statuses' ? 'All Statuses' : tab}
                  {tab === 'All statuses' && <span>{workspace.quotations.length}</span>}
                </button>
              ),
            )}
          </div>
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search Quotations"
              placeholder="Search quotations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {quotes.length ? (
          <div className="table-scroll">
            <table className="quotes-table">
              <thead>
                <tr>
                  <th>Quotation</th>
                  <th>Customer</th>
                  <th>Dates</th>
                  <th className="numeric">Amount · NPR</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <button className="quote-link" onClick={() => onOpen(q)}>
                        <span className="quote-icon">
                          <FileText size={19} strokeWidth={1.6} />
                        </span>
                        <span>
                          {q.number}
                          <small>
                            {q.items.length} line {q.items.length === 1 ? 'item' : 'items'}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <div className="customer-cell">
                        <Avatar name={q.customer.name} photo={q.customer.photo} />
                        <div>
                          <strong>{q.customer.name || 'Customer Not Selected'}</strong>
                          <small>{q.customer.category}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <CreatedDate value={q.createdAt} />
                      <small>Quotation date {formatDate(q.date)}</small>
                      <small>Until {formatDate(q.validUntil)}</small>
                    </td>
                    <td className="numeric amount-cell">
                      {money(calculateTotals(q.items, q.discount, q.vatEnabled, q.vatRate).total)}
                    </td>
                    <td>
                      <span
                        className={`status status-${(q.validUntil < current && ['Valid', 'Sent'].includes(q.status || 'Valid') ? 'Expired' : q.status || 'Valid').toLowerCase()}`}
                      >
                        <i />
                        {q.validUntil < current && ['Valid', 'Sent'].includes(q.status || 'Valid')
                          ? 'Expired'
                          : q.status || 'Valid'}
                      </span>
                    </td>
                    <td className="quote-actions-cell">
                      <div className="record-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit ${q.number}`}
                          title={`Edit ${q.number}`}
                          onClick={() => onOpen(q)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger-button"
                          aria-label={`Delete ${q.number}`}
                          title={`Delete ${q.number}`}
                          onClick={() => onDelete(q)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <FileText size={29} />
            </span>
            <h2>
              {search || filter !== 'All statuses'
                ? 'No Quotations Found'
                : 'Your next opportunity starts here.'}
            </h2>
            <p>
              {search || filter !== 'All statuses'
                ? 'Try a different search or view all quotations.'
                : 'Choose a customer, add your items, and put your best quote forward.'}
            </p>
            {!search && filter === 'All statuses' && (
              <button className="button primary" onClick={() => onOpen()}>
                <Plus size={16} />
                Create Your First Quotation
              </button>
            )}
          </div>
        )}
        <div className="list-footer">
          <span>
            {quotes.length} of {workspace.quotations.length} quotations
          </span>
          <span>Amounts include applicable VAT</span>
        </div>
      </section>
      <div className="workspace-note">
        <span className="note-dot" />
        <p>
          A little detail makes a lasting impression.
          <span>Your company identity, signature, and stamp appear on every new quotation.</span>
        </p>
      </div>
    </>
  );
}
