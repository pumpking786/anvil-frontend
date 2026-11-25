import { useUiState } from '../lib/uiState';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleDollarSign,
  FileText,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  Phone,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import type {
  Lead,
  LeadActivity,
  LeadPriority,
  LeadStage,
  Workspace,
  WorkspaceUser,
} from '../domain/types';
import {
  activityDue,
  crmMetrics,
  customerForLead,
  customerFromLead,
  isOpenLead,
  leadErrors,
  leadProbability,
  LEAD_STAGES,
  newLead,
  nextLeadActivity,
  normalizeLead,
  recordLeadChange,
  STAGE_PROBABILITY,
  validCrmDate,
} from '../domain/crm';
import { formatDate, money, today } from '../domain/quotation';
import { ErrorText, Field, Modal, NumberInput, Spinner } from '../components/ui';

type Props = {
  workspace: Workspace;
  currentUser: WorkspaceUser;
  onSave: (workspace: Workspace) => Promise<void>;
  notify: (message: string) => void;
  onDirty: (dirty: boolean) => void;
  onCreateQuotation: (customerId: string) => void;
};
const emptyActivity = () => ({
  type: 'Call' as LeadActivity['type'],
  subject: '',
  notes: '',
  dueDate: today(),
});
export function CRM({ workspace, currentUser, onSave, notify, onDirty, onCreateQuotation }: Props) {
  const [query, setQuery] = useUiState('CRM.query', '');
  const [owner, setOwner] = useUiState('CRM.owner', 'all');
  const [stageFilter, setStageFilter] = useUiState('CRM.stageFilter', 'all');
  const [priority, setPriority] = useUiState('CRM.priority', 'all');
  const [due, setDue] = useUiState('CRM.due', 'all');
  const [sort, setSort] = useUiState('CRM.sort', 'updated');
  const [view, setView] = useUiState<'board' | 'list'>('CRM.view', 'board');
  const [editing, setEditing] = useUiState<Lead | null>('CRM.editing', null);
  const [baseline, setBaseline] = useUiState('CRM.baseline', '');
  const [tab, setTab] = useUiState<'details' | 'activity'>('CRM.tab', 'details');
  const [activity, setActivity] = useState(emptyActivity);
  const [activityId, setActivityId] = useState<string | null>(null);
  function resetActivity() {
    setActivity(emptyActivity());
    setActivityId(null);
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const dirty =
    !!editing &&
    (JSON.stringify(editing) !== baseline || !!activity.subject.trim() || !!activity.notes.trim());
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const date = today();
  const metrics = crmMetrics(workspace.leads, date);
  const ownerName = (id?: string) =>
    workspace.users.find((user) => user.id === id)?.name ||
    (id ? 'Former team member' : 'Unassigned');
  const filtered = useMemo(
    () =>
      workspace.leads
        .filter((lead) => {
          const text =
            `${lead.name} ${lead.company} ${lead.email} ${lead.phone} ${lead.source} ${lead.nextAction} ${lead.notes}`.toLowerCase();
          return (
            query
              .trim()
              .toLowerCase()
              .split(/\s+/)
              .every((term) => text.includes(term)) &&
            (owner === 'all' ||
              (owner === 'unassigned' ? !lead.ownerId : lead.ownerId === owner)) &&
            (stageFilter === 'all' ||
              (stageFilter === 'open' ? isOpenLead(lead) : lead.stage === stageFilter)) &&
            (priority === 'all' || (lead.priority || 'Normal') === priority) &&
            (due === 'all' ||
              (isOpenLead(lead) &&
                (lead.activities || []).some(
                  (item) => activityDue(item, date).toLowerCase() === due,
                )))
          );
        })
        .sort((a, b) =>
          sort === 'value'
            ? b.expectedValue - a.expectedValue
            : sort === 'close'
              ? (a.expectedClose || '9999').localeCompare(b.expectedClose || '9999')
              : sort === 'followup'
                ? (nextLeadActivity(a)?.dueDate || '9999').localeCompare(
                    nextLeadActivity(b)?.dueDate || '9999',
                  )
                : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [workspace.leads, query, owner, stageFilter, priority, due, sort, date],
  );
  function open(lead: Lead) {
    const draft = normalizeLead(structuredClone(lead));
    setEditing(draft);
    setBaseline(JSON.stringify(draft));
    setErrors({});
    setTab('details');
    resetActivity();
  }
  function close() {
    if (busy || (dirty && !window.confirm('Discard unsaved changes to this opportunity?'))) return;
    setEditing(null);
    setErrors({});
    resetActivity();
  }
  function update<K extends keyof Lead>(key: K, value: Lead[K]) {
    setEditing((lead) => (lead ? { ...lead, [key]: value } : lead));
  }
  async function write(lead: Lead, options?: { customer: ReturnType<typeof customerFromLead> }) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setErrors({});
    try {
      await onSave({
        ...workspace,
        leads: workspace.leads.some((item) => item.id === lead.id)
          ? workspace.leads.map((item) => (item.id === lead.id ? lead : item))
          : [lead, ...workspace.leads],
        customers: options ? [options.customer, ...workspace.customers] : workspace.customers,
      });
      return true;
    } catch (error) {
      setErrors({ form: (error as Error).message });
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function validated(lead: Lead) {
    const next = leadErrors(lead);
    if (activity.subject.trim() || activity.notes.trim())
      next.activity = 'Add the activity to the timeline or clear its draft before saving.';
    setErrors(next);
    if (Object.keys(next).length) {
      setTab(next.activity ? 'activity' : 'details');
      return false;
    }
    return true;
  }
  function prepare(lead: Lead, message: string) {
    return recordLeadChange(
      {
        ...lead,
        name: lead.name.trim(),
        company: lead.company.trim(),
        email: lead.email.trim(),
        phone: lead.phone.trim(),
        probability: leadProbability(lead),
        createdAt: lead.createdAt || lead.updatedAt,
      },
      currentUser.name,
      message,
    );
  }
  async function save() {
    if (!editing || !validated(editing)) return;
    const previous = workspace.leads.find((lead) => lead.id === editing.id);
    const message = !previous
      ? 'Opportunity created'
      : previous.stage !== editing.stage
        ? `Stage changed from ${previous.stage} to ${editing.stage}${editing.stage === 'Lost' ? `: ${editing.lostReason}` : ''}`
        : 'Opportunity updated';
    if (await write(prepare(editing, message))) {
      setEditing(null);
      notify('CRM record saved');
    }
  }
  async function changeStage(lead: Lead, stage: LeadStage) {
    if (busy || stage === lead.stage) return;
    const changed = { ...normalizeLead(lead), stage, probability: STAGE_PROBABILITY[stage] };
    if (stage === 'Lost') {
      open(changed);
      setBaseline(JSON.stringify(normalizeLead(lead)));
      return;
    }
    if (await write(prepare(changed, `Stage changed from ${lead.stage} to ${stage}`)))
      notify(`Moved to ${stage}`);
  }
  async function remove(lead: Lead) {
    if (
      busy ||
      !window.confirm(
        `Delete the CRM record for ${lead.company || lead.name}? Linked customers and quotations will be kept.`,
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setErrors({});
    try {
      await onSave({ ...workspace, leads: workspace.leads.filter((item) => item.id !== lead.id) });
      setEditing(null);
      notify('CRM record deleted');
    } catch (error) {
      setErrors({ form: (error as Error).message });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function convert() {
    if (!editing || !validated(editing)) return;
    const existing = customerForLead(editing, workspace.customers);
    const customer = existing || customerFromLead(editing);
    const lead = prepare(
      { ...editing, customerId: customer.id },
      existing ? `Linked customer: ${customer.name}` : `Customer created: ${customer.name}`,
    );
    if (await write(lead, existing ? undefined : { customer })) {
      setEditing(lead);
      setBaseline(JSON.stringify(lead));
      notify(existing ? 'Existing customer linked' : 'Lead converted to customer');
    }
  }
  function addActivity() {
    if (!editing) return;
    if (!activity.subject.trim()) {
      setErrors({ activity: 'Enter an activity subject.' });
      return;
    }
    if (activity.type !== 'Note' && !validCrmDate(activity.dueDate)) {
      setErrors({ activity: 'Choose a valid follow-up date.' });
      return;
    }
    if (!activityId && (editing.activities || []).length >= 200) {
      setErrors({ activity: 'This opportunity has reached its 200-activity limit.' });
      return;
    }
    const now = new Date().toISOString();
    const previous = editing.activities?.find((entry) => entry.id === activityId);
    const done = activity.type === 'Note' || previous?.status === 'Done';
    const entry: LeadActivity = {
      ...activity,
      id: activityId || crypto.randomUUID(),
      subject: activity.subject.trim(),
      createdAt: previous?.createdAt || now,
      createdBy: previous?.createdBy || currentUser.name,
      status: done ? 'Done' : 'Planned',
      dueDate: activity.type === 'Note' ? '' : activity.dueDate,
      ...(done ? { completedAt: previous?.completedAt || now } : {}),
    };
    setEditing(
      recordLeadChange(
        {
          ...editing,
          activities: activityId
            ? editing.activities!.map((item) => (item.id === activityId ? entry : item))
            : [entry, ...(editing.activities || [])],
        },
        currentUser.name,
        `${activityId ? 'Updated' : 'Added'} ${entry.type.toLowerCase()}: ${entry.subject}`,
      ),
    );
    resetActivity();
    setErrors({});
  }
  function completeActivity(id: string) {
    if (!editing) return;
    const entry = editing.activities?.find((item) => item.id === id);
    if (!entry || entry.status === 'Done') return;
    setEditing(
      recordLeadChange(
        {
          ...editing,
          activities: editing.activities!.map((item) =>
            item.id === id
              ? { ...item, status: 'Done', completedAt: new Date().toISOString() }
              : item,
          ),
        },
        currentUser.name,
        `Completed ${entry.type.toLowerCase()}: ${entry.subject}`,
      ),
    );
  }
  const linkedCustomer =
    editing && workspace.customers.find((customer) => customer.id === editing.customerId);
  const customerQuotes = linkedCustomer
    ? workspace.quotations.filter((quote) => quote.customer.id === linkedCustomer.id)
    : [];
  const activeFilters =
    query || owner !== 'all' || stageFilter !== 'all' || priority !== 'all' || due !== 'all';
  const followup = (lead: Lead) => {
    const next = nextLeadActivity(lead);
    return next ? (
      <span className={`crm-followup due-${activityDue(next, date).toLowerCase()}`}>
        <CalendarClock size={13} />
        <span>
          {next.subject}
          <small>
            {activityDue(next, date)} · {formatDate(next.dueDate)}
          </small>
        </span>
      </span>
    ) : (
      <span className="crm-no-followup">{lead.nextAction || 'No follow-up scheduled'}</span>
    );
  };
  return (
    <div className="business-page crm-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RELATIONSHIPS & OPPORTUNITIES</span>
          <h1>CRM</h1>
          <p>Manage your pipeline, follow-ups and customer relationships.</p>
        </div>
        <button className="button primary" onClick={() => open(newLead(currentUser))}>
          <Plus size={16} />
          Add Lead
        </button>
      </div>
      <div className="crm-metrics">
        <article>
          <UsersRound />
          <span>Open opportunities</span>
          <strong>{metrics.openCount}</strong>
          <small>
            {metrics.won} won ·{' '}
            {metrics.winRate === null
              ? 'No closed opportunities yet'
              : `${metrics.winRate}% win rate`}
          </small>
        </article>
        <article>
          <CircleDollarSign />
          <span>Open pipeline · NPR</span>
          <strong>{money(metrics.pipeline)}</strong>
          <small>Total value of open opportunities</small>
        </article>
        <article>
          <Target />
          <span>Weighted forecast · NPR</span>
          <strong>{money(metrics.weighted)}</strong>
          <small>Open value × win probability</small>
        </article>
        <article>
          <CalendarClock />
          <span>Overdue follow-ups</span>
          <strong>{metrics.overdue}</strong>
          <button
            className="text-button"
            onClick={() => {
              setDue('overdue');
              setStageFilter('open');
            }}
          >
            Review Overdue <ArrowUpRight size={13} />
          </button>
        </article>
      </div>
      <div className="crm-stage-summary" aria-label="Pipeline Overview">
        {LEAD_STAGES.map((stage) => {
          const leads = workspace.leads.filter((lead) => lead.stage === stage);
          return (
            <button
              key={stage}
              className={`stage-summary stage-${stage.toLowerCase()} ${stageFilter === stage ? 'selected' : ''}`}
              onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
              aria-pressed={stageFilter === stage}
            >
              <span>
                {stage}
                <b>{leads.length}</b>
              </span>
              <strong>NPR {money(leads.reduce((sum, lead) => sum + lead.expectedValue, 0))}</strong>
              <i
                style={{
                  width: `${Math.max(3, (leads.length / Math.max(1, workspace.leads.length)) * 100)}%`,
                }}
              />
            </button>
          );
        })}
      </div>
      <section className="crm-toolbar panel">
        <div className="crm-toolbar-top">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search CRM Opportunities"
              placeholder="Search contacts, companies, notes…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="crm-view-switch" aria-label="CRM View">
            <button aria-pressed={view === 'board'} onClick={() => setView('board')}>
              <LayoutGrid size={15} />
              Board
            </button>
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <List size={15} />
              List
            </button>
          </div>
        </div>
        <div className="crm-filters">
          <label>
            Owner
            <select
              aria-label="Filter By Owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              <option value="all">Everyone</option>
              <option value={currentUser.id}>My opportunities</option>
              <option value="unassigned">Unassigned</option>
              {workspace.users
                .filter((user) => user.id !== currentUser.id)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                    {!user.active ? ' (disabled)' : ''}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Stage
            <select
              aria-label="Filter By Stage"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
            >
              <option value="all">All stages</option>
              <option value="open">Open only</option>
              {LEAD_STAGES.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Filter By Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="all">All priorities</option>
              {['Low', 'Normal', 'High', 'Urgent'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Follow-Up
            <select
              aria-label="Filter By Follow-Up"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            >
              <option value="all">Any time</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </label>
          <label>
            Sort
            <select
              aria-label="Sort Opportunities"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="updated">Recently updated</option>
              <option value="value">Highest value</option>
              <option value="close">Expected close</option>
              <option value="followup">Next follow-up</option>
            </select>
          </label>
          {activeFilters && (
            <button
              className="text-button"
              onClick={() => {
                setQuery('');
                setOwner('all');
                setStageFilter('all');
                setPriority('all');
                setDue('all');
              }}
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>
        <p className="crm-result-count">
          {filtered.length} of {workspace.leads.length} opportunities
        </p>
      </section>
      {!editing && <ErrorText>{errors.form}</ErrorText>}
      {!filtered.length ? (
        <div className="business-empty">
          <Activity />
          <h2>{workspace.leads.length ? 'No Opportunities Match' : 'Start With A Prospect'}</h2>
          <p>
            {workspace.leads.length
              ? 'Adjust your filters to see more opportunities.'
              : 'Add a contact, assign an owner and plan your first follow-up.'}
          </p>
          {!workspace.leads.length && (
            <button className="button primary" onClick={() => open(newLead(currentUser))}>
              Add First Lead
            </button>
          )}
        </div>
      ) : view === 'board' ? (
        <div className="crm-board">
          {LEAD_STAGES.filter(
            (stage) =>
              stageFilter === 'all' ||
              (stageFilter === 'open' && !['Won', 'Lost'].includes(stage)) ||
              stageFilter === stage,
          ).map((stage) => (
            <section className={`crm-column crm-${stage.toLowerCase()}`} key={stage}>
              <header>
                <span>{stage}</span>
                <b>{filtered.filter((lead) => lead.stage === stage).length}</b>
              </header>
              {filtered
                .filter((lead) => lead.stage === stage)
                .map((lead) => (
                  <article className="lead-card" key={lead.id}>
                    <div className="lead-card-top">
                      <span
                        className={`crm-priority priority-${(lead.priority || 'Normal').toLowerCase()}`}
                      >
                        {lead.priority || 'Normal'}
                      </span>
                      <button
                        className="icon-button danger-button"
                        aria-label={`Delete ${lead.company || lead.name}`}
                        disabled={busy}
                        onClick={() => void remove(lead)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <button className="crm-lead-title" onClick={() => open(lead)}>
                      {lead.company || lead.name}
                    </button>
                    <p>{lead.company ? lead.name : lead.email || 'Contact details pending'}</p>
                    <div className="lead-value">
                      NPR {money(lead.expectedValue)}
                      <span>{leadProbability(lead)}%</span>
                    </div>
                    <div className="crm-owner">
                      <span>{ownerName(lead.ownerId).slice(0, 1)}</span>
                      {ownerName(lead.ownerId)}
                    </div>
                    {followup(lead)}
                    {lead.expectedClose && (
                      <p className="crm-close-date">
                        Expected close · {formatDate(lead.expectedClose)}
                      </p>
                    )}
                    <div className="lead-card-actions">
                      <select
                        disabled={busy}
                        aria-label={`Move ${lead.name} to stage`}
                        value={lead.stage}
                        onChange={(event) =>
                          void changeStage(lead, event.target.value as LeadStage)
                        }
                      >
                        {LEAD_STAGES.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      <button className="text-button" onClick={() => open(lead)}>
                        Open <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </article>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="crm-list-wrap panel">
          <table className="crm-list">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Owner</th>
                <th>Stage / Priority</th>
                <th>Next Follow-Up</th>
                <th>Expected Close</th>
                <th className="numeric">Value · NPR</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <button className="crm-lead-title" onClick={() => open(lead)}>
                      {lead.company || lead.name}
                    </button>
                    <small>{lead.company ? lead.name : lead.email}</small>
                  </td>
                  <td>{ownerName(lead.ownerId)}</td>
                  <td>
                    <span className={`crm-stage-pill stage-${lead.stage.toLowerCase()}`}>
                      {lead.stage}
                    </span>
                    <small>{lead.priority || 'Normal'} priority</small>
                  </td>
                  <td>{followup(lead)}</td>
                  <td>{lead.expectedClose ? formatDate(lead.expectedClose) : '—'}</td>
                  <td className="numeric">
                    {money(lead.expectedValue)}
                    <small>{leadProbability(lead)}% probability</small>
                  </td>
                  <td>
                    <button
                      className="icon-button danger-button"
                      aria-label={`Delete ${lead.company || lead.name}`}
                      onClick={() => void remove(lead)}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal
          className="crm-modal"
          title={
            workspace.leads.some((lead) => lead.id === editing.id)
              ? 'Edit Opportunity'
              : 'New Opportunity'
          }
          subtitle={editing.company || 'Keep the relationship and next step in one place.'}
          onClose={close}
        >
          <div className="crm-record-tabs">
            <button aria-pressed={tab === 'details'} onClick={() => setTab('details')}>
              Opportunity Details
            </button>
            <button aria-pressed={tab === 'activity'} onClick={() => setTab('activity')}>
              Activities & History <span>{editing.activities?.length || 0}</span>
            </button>
          </div>
          <div className="modal-body crm-record-body">
            <fieldset disabled={busy} className="crm-fieldset">
              {tab === 'details' ? (
                <>
                  <div className="form-grid">
                    <Field label="Contact Name *" error={errors.name}>
                      <input
                        maxLength={200}
                        value={editing.name}
                        onChange={(event) => update('name', event.target.value)}
                      />
                    </Field>
                    <Field label="Company">
                      <input
                        maxLength={200}
                        value={editing.company}
                        onChange={(event) => update('company', event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="form-grid">
                    <Field label="Email" error={errors.email}>
                      <input
                        type="email"
                        value={editing.email}
                        onChange={(event) => update('email', event.target.value)}
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        type="tel"
                        value={editing.phone}
                        onChange={(event) => update('phone', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Address">
                    <input
                      value={editing.address || ''}
                      onChange={(event) => update('address', event.target.value)}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Opportunity Owner">
                      <select
                        value={editing.ownerId || ''}
                        onChange={(event) => update('ownerId', event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {workspace.users
                          .filter((user) => user.active || user.id === editing.ownerId)
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                              {!user.active ? ' (disabled)' : ''}
                            </option>
                          ))}
                        {editing.ownerId &&
                          !workspace.users.some((user) => user.id === editing.ownerId) && (
                            <option value={editing.ownerId}>Former team member</option>
                          )}
                      </select>
                    </Field>
                    <Field label="Priority">
                      <select
                        value={editing.priority}
                        onChange={(event) => update('priority', event.target.value as LeadPriority)}
                      >
                        {['Low', 'Normal', 'High', 'Urgent'].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="form-grid">
                    <Field label="Pipeline Stage">
                      <select
                        value={editing.stage}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            stage: event.target.value as LeadStage,
                            probability: STAGE_PROBABILITY[event.target.value as LeadStage],
                          })
                        }
                      >
                        {LEAD_STAGES.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Source">
                      <input
                        list="crm-sources"
                        value={editing.source}
                        onChange={(event) => update('source', event.target.value)}
                        placeholder="Referral, website, campaign…"
                      />
                      <datalist id="crm-sources">
                        {[
                          'Referral',
                          'Website',
                          'Email',
                          'Phone enquiry',
                          'Event',
                          'Existing customer',
                        ].map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    </Field>
                  </div>
                  {editing.stage === 'Lost' && (
                    <Field label="Lost Reason *" error={errors.lostReason}>
                      <textarea
                        rows={2}
                        value={editing.lostReason || ''}
                        onChange={(event) => update('lostReason', event.target.value)}
                        placeholder="Price, timing, competitor, no longer needed…"
                      />
                    </Field>
                  )}
                  <div className="form-grid crm-financial-fields">
                    <Field label="Expected Value · NPR" error={errors.expectedValue}>
                      <NumberInput
                        min={0}
                        step="0.01"
                        value={editing.expectedValue}
                        onValueChange={(value) => update('expectedValue', value)}
                      />
                    </Field>
                    <Field label="Win Probability · %" error={errors.probability}>
                      <NumberInput
                        disabled={!isOpenLead(editing)}
                        min={0}
                        max={100}
                        value={editing.probability!}
                        onValueChange={(value) => update('probability', value)}
                      />
                    </Field>
                    <Field label="Expected Close Date" error={errors.expectedClose}>
                      <input
                        type="date"
                        value={editing.expectedClose || ''}
                        onChange={(event) => update('expectedClose', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Next Action">
                    <input
                      value={editing.nextAction}
                      onChange={(event) => update('nextAction', event.target.value)}
                      placeholder="What needs to happen next?"
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      rows={3}
                      maxLength={10000}
                      value={editing.notes}
                      onChange={(event) => update('notes', event.target.value)}
                    />
                  </Field>
                  <div className="crm-customer-link">
                    <div>
                      <strong>Customer & Quotations</strong>
                      <p>
                        Link this opportunity to a customer. Conversion keeps its pipeline stage.
                      </p>
                    </div>
                    <Field label="Linked Customer">
                      <select
                        value={editing.customerId || ''}
                        onChange={(event) => update('customerId', event.target.value)}
                      >
                        <option value="">No customer linked</option>
                        {workspace.customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                        {editing.customerId &&
                          !workspace.customers.some(
                            (customer) => customer.id === editing.customerId,
                          ) && (
                            <option value={editing.customerId}>Customer no longer available</option>
                          )}
                      </select>
                    </Field>
                    {!linkedCustomer ? (
                      <button className="button" onClick={() => void convert()}>
                        <UsersRound size={15} />
                        {customerForLead(editing, workspace.customers)
                          ? 'Link Matching Customer'
                          : 'Create Customer From Lead'}
                      </button>
                    ) : (
                      <>
                        <button
                          className="button"
                          disabled={dirty}
                          title={dirty ? 'Save Changes Before Creating A Quotation' : ''}
                          onClick={() => {
                            setEditing(null);
                            onDirty(false);
                            onCreateQuotation(linkedCustomer.id);
                          }}
                        >
                          <FileText size={15} />
                          Create Quotation
                        </button>
                        {dirty && (
                          <p className="field-hint">Save changes before creating a quotation.</p>
                        )}
                        {customerQuotes.length > 0 && (
                          <ul className="crm-linked-quotes" aria-label="Customer Quotations">
                            {customerQuotes.slice(0, 5).map((quote) => (
                              <li key={quote.id}>
                                <span>{quote.number}</span>
                                <span>{quote.status}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="crm-activity-composer">
                    <div className="settings-section-title">
                      <CalendarClock size={17} />
                      <h3>Plan A Follow-Up Or Add A Note</h3>
                    </div>
                    <div className="form-grid">
                      <Field label="Activity Type">
                        <select
                          value={activity.type}
                          onChange={(event) =>
                            setActivity({
                              ...activity,
                              type: event.target.value as LeadActivity['type'],
                            })
                          }
                        >
                          {['Call', 'Email', 'Meeting', 'Task', 'Note'].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </Field>
                      {activity.type !== 'Note' && (
                        <Field label="Follow-Up Date">
                          <input
                            type="date"
                            value={activity.dueDate}
                            onChange={(event) =>
                              setActivity({ ...activity, dueDate: event.target.value })
                            }
                          />
                        </Field>
                      )}
                    </div>
                    <Field label="Activity Subject">
                      <input
                        maxLength={200}
                        value={activity.subject}
                        onChange={(event) =>
                          setActivity({ ...activity, subject: event.target.value })
                        }
                        placeholder="Call to confirm requirements"
                      />
                    </Field>
                    <Field label="Activity Notes">
                      <textarea
                        rows={2}
                        maxLength={10000}
                        value={activity.notes}
                        onChange={(event) =>
                          setActivity({ ...activity, notes: event.target.value })
                        }
                      />
                    </Field>
                    <ErrorText>{errors.activity}</ErrorText>
                    <div className="crm-activity-actions">
                      <button className="button" onClick={addActivity}>
                        <Plus size={15} />
                        {activityId
                          ? 'Save Activity'
                          : activity.type === 'Note'
                            ? 'Add Note'
                            : 'Schedule Activity'}
                      </button>
                      {(activity.subject || activity.notes) && (
                        <button
                          className="text-button"
                          onClick={() => {
                            resetActivity();
                            setErrors({});
                          }}
                        >
                          Clear Draft
                        </button>
                      )}
                    </div>
                    <p className="field-hint">
                      Activities are stored when you save this opportunity. Email activities track
                      follow-ups; they do not send email.
                    </p>
                  </div>
                  <div className="crm-timeline" aria-label="Activity Timeline">
                    {!(editing.activities?.length || editing.history?.length) && (
                      <div className="crm-timeline-empty">
                        <MessageSquare size={22} />
                        <p>No activity yet. Schedule your first follow-up above.</p>
                      </div>
                    )}
                    {[...(editing.activities || [])]
                      .sort((a, b) =>
                        a.status === b.status
                          ? (a.dueDate || a.createdAt).localeCompare(b.dueDate || b.createdAt)
                          : a.status === 'Planned'
                            ? -1
                            : 1,
                      )
                      .map((entry) => (
                        <article
                          className={`crm-activity-entry activity-${entry.status.toLowerCase()}`}
                          key={entry.id}
                        >
                          <span className="crm-timeline-icon">
                            {entry.status === 'Done' ? (
                              <Check size={16} />
                            ) : entry.type === 'Call' ? (
                              <Phone size={16} />
                            ) : entry.type === 'Email' ? (
                              <Mail size={16} />
                            ) : (
                              <CalendarClock size={16} />
                            )}
                          </span>
                          <div>
                            <div className="crm-activity-entry-title">
                              <strong>{entry.subject}</strong>
                              <span
                                className={`crm-due-label due-${activityDue(entry, date).toLowerCase()}`}
                              >
                                {activityDue(entry, date)}
                              </span>
                            </div>
                            <small>
                              {entry.type}
                              {entry.dueDate && ` · ${formatDate(entry.dueDate)}`} ·{' '}
                              {entry.createdBy}
                            </small>
                            {entry.notes && <p>{entry.notes}</p>}
                            <div className="crm-entry-tools">
                              <button
                                type="button"
                                className="text-button"
                                aria-label={`Edit activity ${entry.subject}`}
                                onClick={() => {
                                  setActivityId(entry.id);
                                  setActivity({
                                    type: entry.type,
                                    subject: entry.subject,
                                    notes: entry.notes,
                                    dueDate: entry.dueDate || today(),
                                  });
                                  setErrors({});
                                  document
                                    .querySelector('.crm-record-body')
                                    ?.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-button"
                                aria-label={`Remove activity ${entry.subject}`}
                                onClick={() => {
                                  setEditing(
                                    recordLeadChange(
                                      {
                                        ...editing,
                                        activities: editing.activities!.filter(
                                          (item) => item.id !== entry.id,
                                        ),
                                      },
                                      currentUser.name,
                                      `Removed activity: ${entry.subject}`,
                                    ),
                                  );
                                  if (activityId === entry.id) resetActivity();
                                }}
                              >
                                <Trash2 size={13} />
                                Remove
                              </button>
                            </div>
                            {entry.status === 'Planned' && (
                              <button
                                className="text-button"
                                aria-label={`Complete ${entry.subject}`}
                                onClick={() => completeActivity(entry.id)}
                              >
                                <Check size={14} />
                                Mark Done
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    {!!editing.history?.length && (
                      <h3 className="crm-history-heading">Record History</h3>
                    )}
                    {editing.history?.map((entry) => (
                      <article className="crm-history-entry" key={entry.id}>
                        <span />
                        <div>
                          <p>{entry.message}</p>
                          <small>
                            {entry.by} ·{' '}
                            {new Date(entry.at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
            <ErrorText>{errors.form}</ErrorText>
          </div>
          <div className="modal-actions crm-modal-actions">
            {workspace.leads.some((lead) => lead.id === editing.id) && (
              <button
                className="icon-button danger-button"
                aria-label="Delete Opportunity"
                disabled={busy}
                onClick={() => void remove(editing)}
              >
                <Trash2 size={17} />
              </button>
            )}
            <span>
              {dirty
                ? 'Unsaved changes'
                : workspace.leads.some((lead) => lead.id === editing.id)
                  ? 'All changes saved'
                  : 'New opportunity'}
            </span>
            <button className="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              {busy ? <Spinner /> : <Check size={16} />}Save Lead
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
