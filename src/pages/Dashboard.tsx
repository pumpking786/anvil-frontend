import { useUiState } from '../lib/uiState';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  FileText,
  Plus,
  TrendingUp,
  Users,
  Package,
  BriefcaseBusiness,
} from 'lucide-react';
import type { Quotation, Workspace } from '../domain/types';
import { dashboardMetrics, QUOTATION_STATUSES, quotationStatus } from '../domain/dashboard';
import { calculateTotals, formatDate, money, today } from '../domain/quotation';

const statusColors = {
  Valid: 'var(--chart-valid, #268795)',
  Sent: 'var(--chart-issued, #357ad0)',
  Accepted: 'var(--chart-accepted, #248565)',
  Cancelled: 'var(--chart-cancelled, #c4526e)',
  Draft: 'var(--chart-draft, #8999ac)',
  Expired: 'var(--chart-expired, #ce922d)',
};
const compact = (value: number) =>
  value >= 10_000_000
    ? `${+(value / 10_000_000).toFixed(1)} Cr`
    : value >= 100_000
      ? `${+(value / 100_000).toFixed(1)} L`
      : value >= 1000
        ? `${+(value / 1000).toFixed(1)}k`
        : String(value);

export function Dashboard({
  workspace,
  onOpenQuote,
  onNavigate,
}: {
  workspace: Workspace;
  onOpenQuote: (q?: Quotation) => void;
  onNavigate: (page: 'quotations' | 'customers' | 'products' | 'crm') => void;
}) {
  const [period, setPeriod] = useUiState<6 | 12>('Dashboard.period', 6);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const current = today();
  const metrics = useMemo(
    () => dashboardMetrics(workspace, current, period),
    [workspace, current, period],
  );
  const pipeline = workspace.leads.filter((lead) => !['Won', 'Lost'].includes(lead.stage));
  const pipelineValue = pipeline.reduce((total, lead) => total + lead.expectedValue, 0);
  const lowStock = workspace.products.filter(
    (p) => p.trackInventory && p.quantityOnHand <= p.reorderLevel,
  ).length;
  const maxValue = Math.max(1000, ...metrics.months.map((item) => item.quoted));
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const ceiling = Math.ceil(maxValue / magnitude) * magnitude;
  const x = (i: number) => 70 + i * (650 / (period - 1));
  const y = (value: number) => 220 - (value / ceiling) * 170;
  const points = (key: 'quoted' | 'accepted') =>
    metrics.months.map((item, i) => `${x(i)},${y(item[key])}`).join(' ');
  const selected = metrics.months[hoveredMonth ?? period - 1];
  let cumulative = 0;
  const segments = QUOTATION_STATUSES.map((status) => {
    const start = cumulative;
    cumulative += metrics.quoteCount ? (metrics.counts[status] / metrics.quoteCount) * 100 : 0;
    return `${statusColors[status]} ${start}% ${cumulative}%`;
  }).join(', ');
  return (
    <div className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">BUSINESS OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Your sales, quotations and customer relationships at a glance.</p>
        </div>
        <div className="dashboard-controls">
          <select
            aria-label="Dashboard Period"
            value={period}
            onChange={(e) => {
              setPeriod(Number(e.target.value) as 6 | 12);
              setHoveredMonth(null);
            }}
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button className="button primary" onClick={() => onOpenQuote()}>
            <Plus size={16} />
            New Quotation
          </button>
        </div>
      </div>
      <div className="dashboard-metrics">
        <article className="metric-sales">
          <span className="dashboard-metric-label">
            <FileCheck2 size={18} />
            Accepted sales
          </span>
          <strong>
            <small>NPR</small> {money(metrics.accepted)}
          </strong>
          <p>{metrics.counts.Accepted} accepted quotations</p>
        </article>
        <article className="metric-value">
          <span className="dashboard-metric-label">
            <TrendingUp size={18} />
            Quotation value
          </span>
          <strong>
            <small>NPR</small> {money(metrics.issued)}
          </strong>
          <p>Issued quotes, including accepted sales</p>
        </article>
        <article className="metric-open">
          <span className="dashboard-metric-label">
            <FileText size={18} />
            Open quotations
          </span>
          <strong>{metrics.counts.Valid + metrics.counts.Sent}</strong>
          <p>NPR {money(metrics.open)} awaiting a decision</p>
        </article>
        <article className="metric-win">
          <span className="dashboard-metric-label">
            <ArrowUpRight size={18} />
            Win rate
          </span>
          <strong>{metrics.winRate === null ? '—' : `${metrics.winRate}%`}</strong>
          <p>Accepted ÷ accepted and cancelled quotes</p>
        </article>
      </div>
      <div className="dashboard-charts">
        <section className="panel sales-chart-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Sales Trend</h2>
              <p>Monthly quotation value · NPR, including VAT</p>
            </div>
            <span className="dashboard-period-note">
              {metrics.months[0].fullLabel} – {metrics.months.at(-1)?.fullLabel}
            </span>
          </div>
          <div className="chart-legend">
            <span>
              <i style={{ background: 'var(--chart-issued, #357ad0)' }} />
              Issued quotations
            </span>
            <span>
              <i style={{ background: 'var(--chart-accepted, #248565)' }} />
              Accepted sales
            </span>
          </div>
          <svg
            className="sales-chart"
            viewBox="0 0 760 265"
            role="img"
            aria-label={`Sales trend for the last ${period} months`}
          >
            <title>Issued and accepted quotations by quotation month</title>
            <desc>
              {metrics.months
                .map(
                  (month) =>
                    `${month.fullLabel}: issued NPR ${money(month.quoted)}, accepted NPR ${money(month.accepted)}`,
                )
                .join('; ')}
            </desc>
            {[0, 1, 2, 3, 4].map((tick) => (
              <g key={tick}>
                <line
                  x1="70"
                  x2="720"
                  y1={y((ceiling / 4) * tick)}
                  y2={y((ceiling / 4) * tick)}
                  stroke="var(--chart-grid, #e5ecf3)"
                  strokeDasharray={tick ? '4 5' : undefined}
                />
                <text x="57" y={y((ceiling / 4) * tick) + 4} textAnchor="end">
                  {compact((ceiling / 4) * tick)}
                </text>
              </g>
            ))}
            <polygon
              points={`70,220 ${points('quoted')} 720,220`}
              fill="var(--chart-area, #edf4ff)"
              className="chart-area"
            />
            <polyline
              className="chart-series"
              pathLength={1}
              points={points('quoted')}
              fill="none"
              stroke="var(--chart-issued, #357ad0)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <polyline
              className="chart-series"
              pathLength={1}
              points={points('accepted')}
              fill="none"
              stroke="var(--chart-accepted, #248565)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {metrics.months.map((month, i) => (
              <g key={month.key}>
                <circle
                  cx={x(i)}
                  cy={y(month.accepted)}
                  r={hoveredMonth === i ? 5 : 3.5}
                  fill="var(--chart-accepted, #248565)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
                <text x={x(i)} y="247" textAnchor="middle">
                  {month.label}
                </text>
                <rect
                  x={x(i) - 18}
                  y="35"
                  width="36"
                  height="191"
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${month.fullLabel}, issued ${money(month.quoted)}, accepted ${money(month.accepted)} Nepali Rupees`}
                  onFocus={() => setHoveredMonth(i)}
                  onBlur={() => setHoveredMonth(null)}
                  onMouseEnter={() => setHoveredMonth(i)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  onClick={() => setHoveredMonth(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHoveredMonth(i);
                    }
                  }}
                />
              </g>
            ))}
          </svg>
          <div className="chart-readout">
            <strong>{selected.fullLabel}</strong>
            <span>
              Issued <b>NPR {money(selected.quoted)}</b>
            </span>
            <span>
              Accepted <b>NPR {money(selected.accepted)}</b>
            </span>
          </div>
          <p className="dashboard-data-note">
            Sales represent accepted quotations, grouped by quotation date. Drafts and cancellations
            are excluded from issued value.
          </p>
        </section>
        <section className="panel quotation-status-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Quotation Status</h2>
              <p>Within the selected period</p>
            </div>
          </div>
          <div
            className="dashboard-donut"
            style={{
              background: metrics.quoteCount ? `conic-gradient(${segments})` : 'var(--line)',
            }}
            aria-label={`${metrics.quoteCount} quotations`}
          >
            <div>
              <strong>{metrics.quoteCount}</strong>
              <span>quotations</span>
            </div>
          </div>
          <div className="dashboard-status-legend">
            {QUOTATION_STATUSES.map((status) => (
              <div key={status}>
                <i style={{ background: statusColors[status] }} />
                <span>{status}</span>
                <strong>{metrics.counts[status]}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="dashboard-lower-grid">
        <section className="panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Recent Quotations</h2>
              <p>Most recently updated in this period</p>
            </div>
            <button className="text-button" onClick={() => onNavigate('quotations')}>
              View All
              <ArrowRight size={15} />
            </button>
          </div>
          {metrics.recent.length ? (
            <div className="table-scroll">
              <table className="dashboard-recent-table">
                <thead>
                  <tr>
                    <th>Quotation / Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="numeric">Total · NPR</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <button onClick={() => onOpenQuote(quote)}>{quote.number}</button>
                        <small>{quote.customer.name || 'Customer not selected'}</small>
                      </td>
                      <td>{formatDate(quote.date)}</td>
                      <td>
                        <span
                          className={`status status-${quotationStatus(quote, current).toLowerCase()}`}
                        >
                          {quotationStatus(quote, current)}
                        </span>
                      </td>
                      <td className="numeric">
                        {money(
                          calculateTotals(
                            quote.items,
                            quote.discount,
                            quote.vatEnabled,
                            quote.vatRate,
                          ).total,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty">
              <FileText size={24} />
              <h3>No Quotations In This Period</h3>
              <p>Create your first quotation or choose a longer period.</p>
              <button className="text-button" onClick={() => onOpenQuote()}>
                Create Quotation
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </section>
        <section className="panel dashboard-relationships">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Customer Pipeline</h2>
              <p>Current CRM and catalog</p>
            </div>
            <button className="text-button" onClick={() => onNavigate('crm')}>
              Open CRM
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="dashboard-pipeline-value">
            <BriefcaseBusiness size={20} />
            <div>
              <strong>NPR {money(pipelineValue)}</strong>
              <span>{pipeline.length} open CRM opportunities</span>
            </div>
          </div>
          <div className="dashboard-stage-list">
            {(['New', 'Qualified', 'Proposal', 'Won', 'Lost'] as const).map((stage) => {
              const count = workspace.leads.filter((lead) => lead.stage === stage).length;
              return (
                <div key={stage} className={`pipeline-stage-${stage.toLowerCase()}`}>
                  <span>{stage}</span>
                  <i>
                    <b
                      style={{
                        width: `${workspace.leads.length ? (count / workspace.leads.length) * 100 : 0}%`,
                      }}
                    />
                  </i>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
          <div className="dashboard-directory-links">
            <button onClick={() => onNavigate('customers')}>
              <Users size={18} />
              <span>
                Customers<strong>{workspace.customers.length}</strong>
              </span>
              <ArrowRight size={15} />
            </button>
            <button onClick={() => onNavigate('products')}>
              <Package size={18} />
              <span>
                Products
                <strong>
                  {workspace.products.length}
                  <small>{lowStock ? ` · ${lowStock} at reorder point` : ' in catalog'}</small>
                </strong>
              </span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
