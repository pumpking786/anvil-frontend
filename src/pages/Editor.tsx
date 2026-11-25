import { CustomerDialog } from '../components/CustomerDialog';
import { ProductDialog, emptyProduct } from '../components/ProductDialog';
import type { Product } from '../domain/types';
import { EmailHistoryDetails } from '../components/EmailHistory';
import { CreatedDate } from '../components/CreatedDate';
import { AutoTextarea } from '../components/AutoTextarea';
import { printQuotationPdf } from '../pdf/print';
import { ProductPicker } from '../components/ProductPicker';
import { TextStyleControls, ImageFrameControls } from '../components/AppearanceControls';
import { textCss, textDefaults, documentImageFrame } from '../domain/appearance';
import { resolveDocumentStyle, documentPreviewQuote } from '../domain/document';
import {
  selectProductForLine,
  splitItemDescription,
  joinItemDescription,
} from '../domain/products';
import { useUiState } from '../lib/uiState';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Download,
  Mail,
  Plus,
  Printer,
  Save,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react';
import type {
  Customer,
  Connection,
  LineItem,
  Quotation,
  Workspace,
  WorkspaceUser,
} from '../domain/types';
import { withQuotationPreparer } from '../domain/quotationAuthor';
import {
  addDays,
  amountInWords,
  calculateTotals,
  money,
  quotationErrors,
  draftQuotationErrors,
  VAT_RATE,
  VAT_RATE_ERROR,
  isValidVatRate,
  today,
} from '../domain/quotation';
import { Avatar, ErrorText, Field, Spinner } from '../components/ui';
import { downloadQuotation } from '../pdf/download';
import { nextQuotationNumber, sequenceAfterSave } from '../domain/sequence';
import { DocumentPreview } from '../components/DocumentPreview';
import { EmailComposer } from '../components/EmailComposer';
import { DocumentDesigner } from '../components/DocumentDesigner';
function makeQuote(workspace: Workspace, customer?: Customer): Quotation {
  const date = today();
  return {
    id: crypto.randomUUID(),
    number: nextQuotationNumber(workspace, date),
    date,
    validUntil: addDays(date, workspace.settings.validityDays),
    status: 'Valid',
    customer: customer
      ? { ...customer }
      : {
          id: '',
          name: '',
          category: 'Enterprise',
          pan: '',
          address: '',
          phone: '',
          email: '',
          photo: '',
        },
    company: { ...workspace.company },
    items: [{ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }],
    discount: 0,
    vatEnabled: workspace.settings.defaultVat,
    vatRate: workspace.settings.defaultVatRate ?? VAT_RATE,
    layout: {
      design: workspace.settings.defaultDesign,
      logoWidth: workspace.settings.defaultLogoWidth || 132,
      document: workspace.settings.document
        ? structuredClone(workspace.settings.document)
        : undefined,
    },
    terms: workspace.company.terms,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function Editor({
  draftKey,
  workspace,
  currentUser,
  initial,
  initialCustomer,
  connection,
  onSave,
  onBack,
  onDelete,
  notify,
  onDirty,
}: {
  draftKey: string;
  workspace: Workspace;
  currentUser: WorkspaceUser;
  initial?: Quotation;
  initialCustomer?: Customer;
  connection: Connection;
  onSave: (w: Workspace) => Promise<void>;
  onBack: () => void;
  onDelete: (quote: Quotation) => Promise<void>;
  notify: (s: string) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [quote, setQuote] = useUiState<Quotation>(`editor.${draftKey}.quote`, () =>
    withQuotationPreparer(
      initial ? structuredClone(initial) : makeQuote(workspace, initialCustomer),
      currentUser,
    ),
  );
  const documentStyle = resolveDocumentStyle(quote);
  const [saved, setSaved] = useState(() => {
    const stored = initial || workspace.quotations.find((item) => item.id === quote.id);
    return stored
      ? JSON.stringify(withQuotationPreparer(structuredClone(stored), currentUser))
      : '';
  });
  const [view, setView] = useUiState<'edit' | 'preview'>(`editor.${draftKey}.view`, 'edit');
  const [section, setSection] = useUiState<'lines' | 'terms' | 'design'>(
    `editor.${draftKey}.section`,
    'lines',
  );
  const [lockLogoAspect, setLockLogoAspect] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [emailQuote, setEmailQuote] = useState<Quotation | null>(null);
  const [designer, setDesigner] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [newProduct, setNewProduct] = useState<{ lineId: string; product: Product } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const dirty = JSON.stringify(quote) !== saved;
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const update = <K extends keyof Quotation>(key: K, value: Quotation[K]) =>
    setQuote((q) => ({ ...q, [key]: value }));
  function updateItem(id: string, key: keyof LineItem, value: string | number) {
    update(
      'items',
      quote.items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  }
  function updateDate(value: string) {
    setQuote((current) => {
      const untouchedSuggestion =
        !initial && current.number === nextQuotationNumber(workspace, current.date);
      return {
        ...current,
        date: value,
        number: untouchedSuggestion ? nextQuotationNumber(workspace, value) : current.number,
      };
    });
  }
  let totals: ReturnType<typeof calculateTotals> | null = null;
  try {
    totals = calculateTotals(quote.items, quote.discount, quote.vatEnabled, quote.vatRate);
  } catch {
    /* Inline errors explain invalid draft amounts. */
  }
  function validate(candidate = quote, draft = false) {
    const next = draft ? draftQuotationErrors(candidate) : quotationErrors(candidate);
    if (
      workspace.quotations.some(
        (q) =>
          q.id !== candidate.id && q.number.toLowerCase() === candidate.number.trim().toLowerCase(),
      )
    )
      next.number = 'This quotation number already exists.';
    if (!candidate.company.name.trim())
      next.company = 'Add your company name in Company profile first.';
    setErrors(next);
    if (Object.keys(next).length) {
      setView('edit');
      setSection('lines');
      setTimeout(
        () =>
          document
            .querySelector<HTMLElement>('.invalid input, .invalid select, .invalid textarea')
            ?.focus(),
        0,
      );
      return false;
    }
    return true;
  }
  async function save(candidate = quote, draft = false) {
    if (!validate(candidate, draft)) return;
    setBusy(true);
    try {
      const next: Quotation = {
        ...candidate,
        status: draft ? 'Draft' : candidate.status,
        number: candidate.number.trim(),
        updatedAt: new Date().toISOString(),
      };
      const existing = workspace.quotations.some((q) => q.id === quote.id);
      await onSave({
        ...workspace,
        quotations: existing
          ? workspace.quotations.map((q) => (q.id === next.id ? next : q))
          : [...workspace.quotations, next],
        ...sequenceAfterSave(workspace, next.number, next.date, !existing),
      });
      setQuote(next);
      setSaved(JSON.stringify(next));
      notify(draft ? 'Quotation saved as draft' : 'Quotation saved');
      return next;
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function print() {
    if (!validate()) return;
    setView('preview');
    setPrinting(true);
    const previousTitle = document.title;
    document.title = `${quote.number} - ${quote.customer.name}`;
    try {
      const controller = new AbortController();
      exportController.current = controller;
      await printQuotationPdf(structuredClone(quote), controller.signal);
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError') setErrors({ form: (failure as Error).message });
    } finally {
      document.title = previousTitle;
      setPrinting(false);
    }
  }
  async function download() {
    if (!validate()) return;
    setDownloading(true);
    const controller = new AbortController();
    exportController.current = controller;
    try {
      await downloadQuotation(structuredClone(quote), controller.signal);
      notify('PDF downloaded');
    } catch (err) {
      if (!controller.signal.aborted) setErrors({ form: (err as Error).message });
    } finally {
      if (!controller.signal.aborted) setDownloading(false);
    }
  }
  return (
    <div className="editor-page">
      {newCustomer && (
        <CustomerDialog
          onClose={() => setNewCustomer(false)}
          onSave={async (customer) => {
            await onSave({ ...workspace, customers: [...workspace.customers, customer] });
            setQuote((current) => ({ ...current, customer }));
            notify('Customer created and selected');
          }}
        />
      )}
      {newProduct && (
        <ProductDialog
          value={newProduct.product}
          onChange={(product) =>
            setNewProduct((current) => (current ? { ...current, product } : null))
          }
          onClose={() => setNewProduct(null)}
          submitLabel="Create & Add To Quotation"
          onSave={async (product) => {
            const lineId = newProduct.lineId;
            await onSave({ ...workspace, products: [product, ...workspace.products] });
            setQuote((current) => ({
              ...current,
              items: current.items.map((line) =>
                line.id === lineId ? selectProductForLine(line, product) : line,
              ),
            }));
            notify('Product created and added to this quotation');
          }}
        />
      )}
      {emailQuote && (
        <EmailComposer
          quote={emailQuote}
          currentCustomer={workspace.customers.find(
            (customer) => customer.id === emailQuote.customer.id,
          )}
          user={workspace.users.find((user) => user.id === currentUser.id) || currentUser}
          connection={connection}
          onClose={() => setEmailQuote(null)}
          onSent={async (receipt) => {
            const next = {
              ...emailQuote,
              status: (['Valid', 'Draft'].includes(emailQuote.status)
                ? 'Sent'
                : emailQuote.status) as Quotation['status'],
              updatedAt: new Date().toISOString(),
            };
            await onSave({
              ...workspace,
              quotations: workspace.quotations.map((q) => (q.id === next.id ? next : q)),
            });
            setQuote(next);
            setSaved(JSON.stringify(next));
            notify(
              receipt.partial
                ? 'Quotation partially sent — check the recipient warning.'
                : 'Quotation Sent Successfully!',
            );
          }}
        />
      )}
      {designer && (
        <DocumentDesigner
          quote={quote}
          onClose={() => setDesigner(false)}
          onSaveDraft={async ({ document, logo, logoWidth }) => {
            const candidate = {
              ...quote,
              company: { ...quote.company, logo },
              layout: { ...quote.layout, logoWidth, document },
            };
            const result = await save(candidate, true);
            if (result) {
              setDesigner(false);
              return true;
            }
            return false;
          }}
          onApply={({ document, logo, logoWidth }) => {
            setQuote((current) => ({
              ...current,
              company: { ...current.company, logo },
              layout: { ...current.layout, logoWidth, document },
            }));
            setDesigner(false);
          }}
        />
      )}
      <div className="editor-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={15} />
            All Quotations
          </button>
          <div className="editor-title">
            <h1>{saved ? quote.number : 'New Quotation'}</h1>
            <span className={`draft-tag ${dirty ? '' : 'saved'}`}>
              {dirty ? (
                'Unsaved changes'
              ) : (
                <>
                  <Check size={12} />
                  {quote.status === 'Draft' ? 'Saved draft' : 'Saved'}
                </>
              )}
            </span>
          </div>
          {saved && <CreatedDate value={quote.createdAt} />}
        </div>
        <div className="heading-actions quotation-actions">
          <div className="quotation-save-actions">
            <button
              className="button primary"
              onClick={() => save()}
              disabled={busy || printing || downloading}
            >
              {busy ? <Spinner /> : <Save size={16} />}Save Quotation
            </button>
            <button
              className="button"
              disabled={busy || printing || downloading}
              onClick={() => save(quote, true)}
            >
              <FileText size={16} />
              Save As Draft
            </button>
          </div>
          <div className="quotation-output-actions">
            {workspace.quotations.some((item) => item.id === quote.id) && (
              <button
                className="button danger quotation-delete"
                disabled={busy || printing || downloading}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete quotation ${quote.number}? This also discards unsaved edits. This cannot be undone.`,
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await onDelete(quote);
                  } catch (failure) {
                    setErrors({ form: (failure as Error).message });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={16} />
                Delete Quotation
              </button>
            )}
            <button
              className="button"
              disabled={busy || printing || downloading}
              onClick={async () => {
                if (!validate()) return;
                const next = dirty ? await save() : quote;
                if (next) setEmailQuote(next);
              }}
            >
              <Mail size={16} />
              Email Customer
            </button>
            <button
              className="button"
              onClick={download}
              disabled={busy || printing || downloading}
            >
              {downloading ? <Spinner /> : <Download size={16} />}
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button className="button" onClick={print} disabled={busy || printing || downloading}>
              {printing ? <Spinner /> : <Printer size={16} />}Print
            </button>
          </div>
        </div>
      </div>
      <div className="editor-view-bar">
        <div className="tabs">
          <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>
            Quotation Details
          </button>
          <button
            className={view === 'preview' ? 'active' : ''}
            onClick={() => {
              if (validate()) setView('preview');
            }}
          >
            <FileText size={14} />
            Document Preview
          </button>
        </div>
        <div className="quotation-status-control">
          <Field label="Quotation Status">
            <select
              value={quote.status || 'Valid'}
              onChange={(e) => update('status', e.target.value as Quotation['status'])}
            >
              {['Draft', 'Valid', 'Sent', 'Accepted', 'Cancelled'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <ErrorText>{errors.form || errors.company}</ErrorText>
      {view === 'preview' ? (
        <div className="document-stage">
          <div className="preview-note">
            <span>A4 · Exact PDF preview</span>
            <span>This is the same layout used for download, print and email.</span>
          </div>
          <DocumentPreview quote={quote} />
        </div>
      ) : (
        <div className="editor-grid">
          <div className="editor-main">
            <section className="panel">
              <div className="panel-heading">
                <span className="step-number">01</span>
                <h2>Quotation Details</h2>
                <span>THE ESSENTIALS</span>
              </div>
              <div className="panel-body">
                <div className="form-grid three">
                  <Field label="Quotation Number *" error={errors.number}>
                    <input
                      value={quote.number}
                      onChange={(e) => update('number', e.target.value)}
                      maxLength={60}
                    />
                  </Field>
                  <Field label="Quotation Date *" error={errors.date}>
                    <input
                      type="date"
                      value={quote.date}
                      onChange={(e) => updateDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Valid Until *" error={errors.validUntil}>
                    <input
                      type="date"
                      value={quote.validUntil}
                      min={quote.date}
                      onChange={(e) => update('validUntil', e.target.value)}
                    />
                  </Field>
                </div>
                <div className="customer-select-row">
                  <Field label="Prepared For *" error={errors.customer}>
                    <select
                      value={quote.customer.id}
                      onChange={(e) => {
                        const customer = workspace.customers.find((c) => c.id === e.target.value);
                        if (customer) update('customer', { ...customer });
                      }}
                    >
                      <option value="" disabled>
                        Select a customer
                      </option>
                      {quote.customer.id &&
                        !workspace.customers.some((c) => c.id === quote.customer.id) && (
                          <option value={quote.customer.id}>{quote.customer.name}</option>
                        )}
                      {workspace.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button className="button small" onClick={() => setNewCustomer(true)}>
                    <Plus size={15} /> New Customer
                  </button>
                </div>
                {quote.customer.name ? (
                  <div className="selected-customer">
                    <Avatar name={quote.customer.name} photo={quote.customer.photo} />
                    <div>
                      <strong>{quote.customer.name}</strong>
                      <p>{quote.customer.address || 'No address added'}</p>
                      <span>
                        {quote.customer.pan
                          ? `VAT / PAN: ${quote.customer.pan}`
                          : 'VAT / PAN not added'}
                        {quote.customer.email ? ` · ${quote.customer.email}` : ''}
                      </span>
                    </div>
                    <span className="category">{quote.customer.category}</span>
                  </div>
                ) : (
                  <div className="customer-placeholder">
                    <UserRound size={18} />
                    <span>Your customer’s details will appear here.</span>
                  </div>
                )}
              </div>
            </section>
            <div className="quotation-notebook">
              <div className="quotation-notebook-heading">
                <button
                  type="button"
                  className="button quotation-layout-action"
                  onClick={() => setDesigner(true)}
                >
                  <SlidersHorizontal size={16} />
                  Configure Document Layout
                </button>
                <div
                  className="quotation-section-tabs"
                  role="tablist"
                  aria-label="Quotation Sections"
                >
                  {(
                    [
                      ['lines', 'Order Lines'],
                      ['terms', 'Terms & Conditions'],
                      ['design', 'Document Design'],
                    ] as const
                  ).map(([key, label], index, tabs) => (
                    <button
                      type="button"
                      key={key}
                      id={`quote-tab-${key}`}
                      role="tab"
                      aria-controls={`quote-panel-${key}`}
                      aria-selected={section === key}
                      tabIndex={section === key ? 0 : -1}
                      onClick={() => setSection(key)}
                      onKeyDown={(event) => {
                        const next =
                          event.key === 'ArrowRight'
                            ? (index + 1) % tabs.length
                            : event.key === 'ArrowLeft'
                              ? (index + tabs.length - 1) % tabs.length
                              : event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? tabs.length - 1
                                  : -1;
                        if (next < 0) return;
                        event.preventDefault();
                        setSection(tabs[next][0]);
                        document.getElementById(`quote-tab-${tabs[next][0]}`)?.focus();
                      }}
                    >
                      {label}
                      {key === 'lines' && <span>{quote.items.length}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <section
                className="panel line-item-panel"
                role="tabpanel"
                id="quote-panel-lines"
                aria-labelledby="quote-tab-lines"
                hidden={section !== 'lines'}
              >
                <div className="panel-heading">
                  <span className="step-number">02</span>
                  <h2>Line Items</h2>
                  <span>PRICES IN NPR</span>
                </div>
                <div className="line-items">
                  <div className="line-item-labels">
                    <span>Description</span>
                    <span>Qty</span>
                    <span>Unit price</span>
                    <span className="numeric">Amount</span>
                    <span />
                  </div>
                  {quote.items.map((item, index) => (
                    <div className="line-item-wrap" key={item.id}>
                      <div className="line-item-row">
                        <div
                          className={`line-description ${errors[`description-${index}`] ? 'invalid' : ''}`}
                        >
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <div className="line-description-fields">
                            <ProductPicker
                              products={workspace.products}
                              label={`Item ${index + 1} description`}
                              style={textCss(documentStyle, 'itemDescription', item.appearance)}
                              value={splitItemDescription(item.description).title}
                              onChange={(value) =>
                                updateItem(
                                  item.id,
                                  'description',
                                  joinItemDescription(
                                    value,
                                    splitItemDescription(item.description).details,
                                  ),
                                )
                              }
                              onCreate={(name) =>
                                setNewProduct({
                                  lineId: item.id,
                                  product: {
                                    ...emptyProduct(workspace.settings.lowStockThreshold),
                                    name: name.slice(0, 150),
                                    salesDescription: splitItemDescription(
                                      item.description,
                                    ).details.slice(0, 800),
                                    salePrice: item.unitPrice,
                                  },
                                })
                              }
                              onSelect={(product) => {
                                update(
                                  'items',
                                  quote.items.map((line) =>
                                    line.id === item.id
                                      ? selectProductForLine(line, product)
                                      : line,
                                  ),
                                );
                                notify(`${product.name} selected`);
                              }}
                              maxLength={Math.max(
                                0,
                                2000 -
                                  (splitItemDescription(item.description).details.length
                                    ? splitItemDescription(item.description).details.length + 1
                                    : 0),
                              )}
                            />
                            <AutoTextarea
                              aria-label={`Item ${index + 1} sales short description`}
                              className="line-sales-description"
                              rows={2}
                              placeholder="Sales short description (optional)"
                              value={splitItemDescription(item.description).details}
                              style={{
                                textAlign:
                                  item.appearance?.align ||
                                  documentStyle.text?.itemDescription?.align,
                              }}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  'description',
                                  joinItemDescription(
                                    splitItemDescription(item.description).title,
                                    e.target.value,
                                  ),
                                )
                              }
                              maxLength={Math.max(
                                0,
                                1999 - splitItemDescription(item.description).title.length,
                              )}
                            />
                          </div>
                        </div>
                        <input
                          className={errors[`quantity-${index}`] ? 'invalid-input' : ''}
                          aria-label={`Item ${index + 1} quantity`}
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={Number.isNaN(item.quantity) ? '' : item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              'quantity',
                              e.target.value === '' ? NaN : Number(e.target.value),
                            )
                          }
                        />
                        <input
                          className={errors[`price-${index}`] ? 'invalid-input' : ''}
                          aria-label={`Item ${index + 1} unit price`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number.isNaN(item.unitPrice) ? '' : item.unitPrice}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              'unitPrice',
                              e.target.value === '' ? NaN : Number(e.target.value),
                            )
                          }
                        />
                        <span className="line-total">
                          {totals ? money(totals.lines[index]) : '—'}
                        </span>
                        <button
                          className="icon-button delete-item"
                          aria-label={`Remove item ${index + 1}`}
                          onClick={() =>
                            update(
                              'items',
                              quote.items.filter((i) => i.id !== item.id),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="line-item-format">
                        <span>Item {index + 1} style</span>
                        <TextStyleControls
                          compact
                          label={`Item ${index + 1}`}
                          value={item.appearance}
                          defaults={{
                            ...textDefaults(documentStyle, 'itemDescription'),
                            ...documentStyle.text?.itemDescription,
                          }}
                          onChange={(appearance) =>
                            update(
                              'items',
                              quote.items.map((row) =>
                                row.id === item.id ? { ...row, appearance } : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <ErrorText>
                        {errors[`description-${index}`] ||
                          errors[`quantity-${index}`] ||
                          errors[`price-${index}`]}
                      </ErrorText>
                    </div>
                  ))}
                  <ErrorText>{errors.items}</ErrorText>
                  <button
                    className="add-item"
                    disabled={quote.items.length >= 200}
                    onClick={() =>
                      update('items', [
                        ...quote.items,
                        { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
                      ])
                    }
                  >
                    <Plus size={16} />
                    Add A Line Item<span>Up To 200 Items</span>
                  </button>
                </div>
              </section>
              <section
                className="panel"
                role="tabpanel"
                id="quote-panel-terms"
                aria-labelledby="quote-tab-terms"
                hidden={section !== 'terms'}
              >
                <div className="panel-heading">
                  <span className="step-number">03</span>
                  <h2>Terms & Conditions</h2>
                  <ChevronDown size={16} />
                </div>
                <div className="panel-body">
                  <Field label="Included At The Bottom Of Your Quotation">
                    <textarea
                      className="terms-input"
                      rows={5}
                      aria-label="Terms And Conditions"
                      value={quote.terms}
                      onChange={(e) => update('terms', e.target.value)}
                      maxLength={10000}
                    />
                  </Field>
                </div>
              </section>
              <section
                className="panel quotation-design-panel"
                role="tabpanel"
                id="quote-panel-design"
                aria-labelledby="quote-tab-design"
                hidden={section !== 'design'}
              >
                <div className="panel-heading">
                  <h2>Document Design</h2>
                  <span>LIVE A4 PREVIEW</span>
                </div>
                <div className="panel-body">
                  <p className="section-description">
                    Resize your logo and see the result immediately. Use Configure document layout
                    for headers, fonts, colors and images.
                  </p>
                  {documentStyle.headerImage ? (
                    <p className="field-hint">
                      Your uploaded letterhead controls the document background. Open Configure
                      document layout to resize it, preserve its proportions or auto-fit it to A4.
                    </p>
                  ) : quote.company.logo ? (
                    <ImageFrameControls
                      label="Quotation Logo"
                      value={documentImageFrame(quote, 'logo')}
                      minWidth={70}
                      maxWidth={260}
                      maxHeight={160}
                      lockAspect={lockLogoAspect}
                      onLockAspectChange={setLockLogoAspect}
                      onChange={(frame) =>
                        update('layout', {
                          ...quote.layout,
                          logoWidth: Math.round(frame.width),
                          document: {
                            ...documentStyle,
                            images: { ...documentStyle.images, logo: frame },
                          },
                        })
                      }
                    />
                  ) : (
                    <p className="field-hint">
                      Add a quotation logo in Configure document layout to resize it here.
                    </p>
                  )}
                </div>
                {section === 'design' &&
                  (() => {
                    const sample = Object.keys(quotationErrors(quote)).length > 0;
                    const preview = sample
                      ? {
                          ...documentPreviewQuote(quote.company, {
                            ...workspace.settings,
                            defaultVat: quote.vatEnabled,
                            defaultVatRate: isValidVatRate(quote.vatRate ?? VAT_RATE)
                              ? quote.vatRate
                              : VAT_RATE,
                          }),
                          layout: quote.layout,
                        }
                      : quote;
                    return (
                      <div className="quotation-inline-preview">
                        <div className="preview-note">
                          <span>
                            {sample
                              ? 'Layout preview · Sample customer and items'
                              : 'Your quotation · A4'}
                          </span>
                        </div>
                        <DocumentPreview quote={preview} designer />
                      </div>
                    );
                  })()}
              </section>
            </div>
          </div>
          <aside className="editor-aside">
            <section className="summary-card">
              <span className="eyebrow">QUOTATION SUMMARY</span>
              <div className="summary-amount">
                <span>NPR</span>
                <strong>{totals ? money(totals.total) : '—'}</strong>
                <p>Grand total, including applicable VAT</p>
              </div>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{totals ? money(totals.subtotal) : '—'}</dd>
                </div>
              </dl>
              <Field label="Discount (NPR)" error={errors.discount}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number.isNaN(quote.discount) ? '' : quote.discount}
                  onChange={(e) =>
                    update('discount', e.target.value === '' ? NaN : Number(e.target.value))
                  }
                />
              </Field>
              <dl>
                <div>
                  <dt>Taxable Amount</dt>
                  <dd>{totals ? money(totals.taxable) : '—'}</dd>
                </div>
              </dl>
              <div className="vat-toggle-row">
                <div>
                  <strong>VAT</strong>
                  <span>Applied after discount</span>
                </div>
                <button
                  className={`toggle ${quote.vatEnabled ? 'on' : ''}`}
                  type="button"
                  role="switch"
                  aria-checked={quote.vatEnabled}
                  aria-label="Apply VAT"
                  onClick={() => update('vatEnabled', !quote.vatEnabled)}
                >
                  <span />
                </button>
              </div>
              <Field
                label="VAT Rate (%)"
                error={
                  errors.vatRate ||
                  (!isValidVatRate(quote.vatRate ?? VAT_RATE) ? VAT_RATE_ERROR : undefined)
                }
                hint="Saved with this quotation. Applied to the amount after discount."
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={Number.isNaN(quote.vatRate) ? '' : (quote.vatRate ?? VAT_RATE)}
                  onChange={(event) =>
                    update('vatRate', event.target.value === '' ? NaN : Number(event.target.value))
                  }
                />
              </Field>
              <dl>
                <div>
                  <dt>VAT Amount</dt>
                  <dd>{totals ? money(totals.vat) : '—'}</dd>
                </div>
                <div className="summary-total">
                  <dt>Grand Total</dt>
                  <dd>{totals ? money(totals.total) : '—'}</dd>
                </div>
              </dl>
              <div className="summary-words">
                <span>NEPALI RUPEES</span>
                <p>
                  {totals
                    ? amountInWords(totals.total)
                    : 'Complete valid line items to calculate your total.'}
                </p>
              </div>
            </section>
            <div className="editor-tip">
              <FileText size={20} />
              <div>
                <strong>Your identity, on every page.</strong>
                <p>
                  Your company details, signature, and stamp are included in the document. Saved
                  quotations keep their original details.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
      {currentUser.role === 'super_admin' && (
        <EmailHistoryDetails
          title="Quotation Email History"
          connection={connection}
          quotationId={quote.id}
        />
      )}
    </div>
  );
}
