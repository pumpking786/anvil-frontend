import { LetterheadEditor } from './LetterheadEditor';
import { TableAppearanceEditor } from './TableAppearanceEditor';
import { TextStyleControls, ImageFrameControls } from './AppearanceControls';
import { TEXT_SECTIONS, textDefaults, documentImageFrame } from '../domain/appearance';
import { useState, useMemo, type ReactNode } from 'react';
import { Check, ChevronDown, Download, RotateCcw } from 'lucide-react';
import type { DocumentStyle, Quotation, TextSection, ImageFrame } from '../domain/types';
import {
  defaultDocumentStyle,
  documentPreviewQuote,
  DOCUMENT_FONTS,
  HEADER_STYLES,
  HEADER_LABELS,
  resolveDocumentStyle,
  TABLE_STYLES,
} from '../domain/document';
import { quotationErrors } from '../domain/quotation';
import { companyHeaderContent } from '../domain/company';
import { Field, ImageUpload, Modal, Spinner, ErrorText } from './ui';
import { DocumentPreview } from './DocumentPreview';
import { downloadQuotation } from '../pdf/download';

function LayoutSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="layout-section">
      <summary>
        {title}
        <ChevronDown size={16} />
      </summary>
      <div className="layout-section-body">{children}</div>
    </details>
  );
}
export interface DocumentSelection {
  document: DocumentStyle;
  logo: string;
  logoWidth: number;
}
export function DocumentDesigner({
  quote,
  onApply,
  onSaveDraft,
  onClose,
}: {
  quote: Quotation;
  onApply: (selection: DocumentSelection) => void;
  onSaveDraft?: (selection: DocumentSelection) => Promise<boolean>;
  onClose: () => void;
}) {
  const [style, setStyle] = useState(() => resolveDocumentStyle(quote));
  const [logo, setLogo] = useState(quote.company.logo);
  const [logoWidth, setLogoWidth] = useState(quote.layout.logoWidth || 132);
  const [textSection, setTextSection] = useState<TextSection>('headerTitle');
  const [imageSlot, setImageSlot] = useState<'logo' | 'signature' | 'stamp'>('logo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof DocumentStyle>(field: K, value: DocumentStyle[K]) =>
    setStyle((previous) => ({ ...previous, [field]: value }));
  const illustrative = Object.keys(quotationErrors(quote)).length > 0;
  const sample = useMemo(() => documentPreviewQuote(quote.company), [quote.company]);
  const content = illustrative ? sample : quote;
  const preview: Quotation = {
    ...content,
    company: { ...content.company, logo },
    layout: { ...quote.layout, logoWidth, document: style },
  };
  const headerContent = companyHeaderContent(quote.company, style.headerContent);
  const setImageFrame = (frame: ImageFrame) => {
    if (imageSlot === 'logo') setLogoWidth(Math.min(260, Math.max(70, frame.width)));
    update('images', { ...style.images, [imageSlot]: frame });
  };
  const changed =
    JSON.stringify({ style, logo, logoWidth }) !==
    JSON.stringify({
      style: resolveDocumentStyle(quote),
      logo: quote.company.logo,
      logoWidth: quote.layout.logoWidth,
    });
  function close() {
    if (!busy && (!changed || window.confirm('Discard the document layout changes?'))) onClose();
  }
  return (
    <Modal
      title="Configure Your Document Layout"
      subtitle="Customize the header, typography and tables. Previewed on A4 paper."
      className="document-designer"
      onClose={close}
    >
      <div className="designer-body">
        <div className="designer-controls">
          <fieldset disabled={busy}>
            <legend className="sr-only">Document Appearance</legend>
            <LetterheadEditor style={style} onChange={setStyle} />
            <details className="layout-section" open={!style.headerImage}>
              <summary>
                Header Designs
                <ChevronDown size={16} />
              </summary>
              <div className="layout-section-body">
                {style.headerImage && (
                  <p className="field-hint">Remove the uploaded letterhead to use these designs.</p>
                )}{' '}
                <div className="designer-control">
                  <span className="field-label" id="header-style-label">
                    Header layout
                  </span>
                  <div className="style-options" role="group" aria-labelledby="header-style-label">
                    {HEADER_STYLES.map((header) => (
                      <button
                        type="button"
                        key={header}
                        data-autofocus={header === HEADER_STYLES[0] ? 'true' : undefined}
                        aria-pressed={!style.headerImage && style.header === header}
                        disabled={!!style.headerImage}
                        onClick={() => update('header', header)}
                      >
                        <span className={`style-thumbnail thumbnail-${header}`} aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span>{HEADER_LABELS[header]}</span>
                        {!style.headerImage && style.header === header && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>
            <div className="designer-control">
              <span className="field-label" id="table-style-label">
                Table style
              </span>
              <div className="table-style-options" role="group" aria-labelledby="table-style-label">
                {TABLE_STYLES.map((table) => (
                  <button
                    type="button"
                    key={table}
                    aria-pressed={style.table === table}
                    onClick={() => update('table', table)}
                  >
                    {table[0].toUpperCase() + table.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <LayoutSection title="Table Colors">
              <TableAppearanceEditor style={style} onChange={setStyle} />
            </LayoutSection>
            <LayoutSection title="Typography & Colors">
              {' '}
              <div className="form-grid">
                <Field label="Document Font">
                  <select
                    value={style.font}
                    onChange={(event) =>
                      update('font', event.target.value as DocumentStyle['font'])
                    }
                  >
                    {Object.entries(DOCUMENT_FONTS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Body Text Size">
                  <select
                    value={style.fontSize}
                    onChange={(event) => update('fontSize', Number(event.target.value))}
                  >
                    <option value={9}>Compact · 9 pt</option>
                    <option value={9.5}>Standard · 9.5 pt</option>
                    <option value={10}>Comfortable · 10 pt</option>
                    <option value={11}>Large · 11 pt</option>
                  </select>
                </Field>
              </div>
              <p className="field-hint">
                Headings, details and totals follow the selected text size. Long content continues
                onto another A4 page.
              </p>
              <div className="designer-colors">
                <Field label="Primary Color">
                  <input
                    type="color"
                    value={style.primaryColor}
                    onChange={(event) => update('primaryColor', event.target.value)}
                  />
                </Field>
                <Field label="Text Color">
                  <input
                    type="color"
                    value={style.textColor}
                    onChange={(event) => update('textColor', event.target.value)}
                  />
                </Field>
              </div>
            </LayoutSection>
            <LayoutSection title="Company Header Text">
              {style.headerImage && (
                <p className="field-hint">
                  Your uploaded letterhead contains the header text. Remove it above to edit these
                  fields.
                </p>
              )}
              <fieldset disabled={!!style.headerImage}>
                {' '}
                <Field
                  label="Header Title"
                  hint="A prominent company or document heading beside the logo, as on your letterhead."
                >
                  <input
                    value={style.tagline}
                    maxLength={120}
                    onChange={(event) => update('tagline', event.target.value)}
                    placeholder="e.g. एनभिल टेक्नोलोजिज प्रा. लि."
                  />
                </Field>
                <Field
                  label="Header Subtitle"
                  hint="An optional second line below the title. Full letterhead images replace these text fields."
                >
                  <input
                    value={style.subtitle || ''}
                    maxLength={120}
                    onChange={(e) => update('subtitle', e.target.value)}
                    placeholder="e.g. ANVIL TECHNOLOGIES PVT. LTD."
                  />
                </Field>
                <Field label={`Header title size · ${style.titleSize || 18} pt`}>
                  <input
                    type="range"
                    min={12}
                    max={26}
                    step={1}
                    value={style.titleSize || 18}
                    onChange={(e) => {
                      const size = Number(e.target.value);
                      setStyle((previous) => ({
                        ...previous,
                        titleSize: size,
                        text: previous.text?.headerTitle?.size
                          ? {
                              ...previous.text,
                              headerTitle: { ...previous.text.headerTitle, size },
                            }
                          : previous.text,
                      }));
                    }}
                  />
                </Field>
                <section className="designer-text-section" aria-label="Company Header Text">
                  <div className="settings-section-title">
                    <span className="eyebrow">COMPANY HEADER TEXT</span>
                    <h3>Edit your contact lines and slogan.</h3>
                  </div>
                  {(
                    [
                      ['registration', 'VAT / PAN & Address Line'],
                      ['contact', 'Phone & Email Line'],
                      ['slogan', 'Company Slogan Text'],
                    ] as const
                  ).map(([key, label]) => (
                    <div className="header-field-editor" key={key}>
                      <Field label={label}>
                        <input
                          value={headerContent[key]}
                          maxLength={key === 'slogan' ? 120 : 500}
                          onFocus={() => setTextSection(key)}
                          onChange={(event) =>
                            update('headerContent', {
                              ...style.headerContent,
                              [key]: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <TextStyleControls
                        label={label}
                        shortLabels
                        value={style.text?.[key]}
                        defaults={textDefaults(style, key)}
                        onChange={(value) => update('text', { ...style.text, [key]: value })}
                        maxSize={14}
                      />
                    </div>
                  ))}
                  <p className="field-hint">
                    Edit the complete wording, including labels and separators. Leave a field blank
                    to hide it. Each field has its own font, size, color, emphasis and alignment.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!style.headerContent}
                    onClick={() => update('headerContent', undefined)}
                  >
                    <RotateCcw size={14} /> Use Company Details
                  </button>
                </section>
              </fieldset>
            </LayoutSection>
            <LayoutSection title="Text Appearance">
              {' '}
              <section className="designer-text-section">
                <div className="settings-section-title">
                  <span className="eyebrow">TEXT APPEARANCE</span>
                  <h3>Every detail, your style.</h3>
                </div>
                <Field label="Text Section">
                  <select
                    value={textSection}
                    onChange={(e) => setTextSection(e.target.value as TextSection)}
                  >
                    {[...new Set(TEXT_SECTIONS.map((s) => s.group))].map((group) => (
                      <optgroup key={group} label={group}>
                        {TEXT_SECTIONS.filter((s) => s.group === group).map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <TextStyleControls
                  label="Selected Text"
                  value={style.text?.[textSection]}
                  defaults={textDefaults(style, textSection)}
                  onChange={(value) => update('text', { ...style.text, [textSection]: value })}
                  maxSize={['headerTitle', 'documentTitle'].includes(textSection) ? 28 : 14}
                />
                <p className="field-hint">
                  Contact lines and the slogan are styled separately. Italics use the selected Latin
                  font; Nepali script uses Noto Devanagari with regular or bold weight.
                </p>
                <div className="style-global-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setStyle((previous) => ({
                        ...previous,
                        tableText: undefined,
                        text: Object.fromEntries(
                          TEXT_SECTIONS.map((section) => [
                            section.key,
                            { ...previous.text?.[section.key], color: previous.textColor },
                          ]),
                        ),
                      }))
                    }
                  >
                    Apply Text Color To All Sections
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        'text',
                        Object.fromEntries(
                          TEXT_SECTIONS.map((s) => [
                            s.key,
                            { ...style.text?.[s.key], font: undefined },
                          ]),
                        ),
                      )
                    }
                  >
                    Use Document Font Everywhere
                  </button>
                </div>
              </section>
            </LayoutSection>
            <LayoutSection title="Quotation Logo">
              <fieldset disabled={!!style.headerImage}>
                {' '}
                <div className="designer-control">
                  <ImageUpload label="Quotation Logo" value={logo} onChange={setLogo} />
                  <Field label={`Quotation logo width · ${logoWidth}px`}>
                    <input
                      type="range"
                      min={70}
                      max={260}
                      step={1}
                      value={logoWidth}
                      onChange={(event) => setLogoWidth(Number(event.target.value))}
                    />
                  </Field>
                </div>
              </fieldset>
            </LayoutSection>
            <LayoutSection title="Image Placement">
              {' '}
              <section className="designer-image-section">
                <div className="settings-section-title">
                  <span className="eyebrow">IMAGE PLACEMENT</span>
                  <h3>Fit your brand to the page.</h3>
                </div>
                <Field label="Image To Adjust">
                  <select
                    value={imageSlot}
                    onChange={(e) => setImageSlot(e.target.value as typeof imageSlot)}
                  >
                    <option value="logo" disabled={!!style.headerImage}>
                      Quotation logo
                    </option>

                    <option value="signature">Signature</option>
                    <option value="stamp">Company stamp</option>
                  </select>
                </Field>
                <fieldset disabled={!!style.headerImage && imageSlot === 'logo'}>
                  <ImageFrameControls
                    label="Document Image"
                    value={documentImageFrame(preview, imageSlot)}
                    onChange={setImageFrame}
                    minWidth={imageSlot === 'logo' ? 70 : 16}
                    maxWidth={260}
                    maxHeight={160}
                  />
                </fieldset>
                <p className="field-hint">
                  Fit preserves the entire image. Fill crops to the frame; position selects the
                  visible area. Signature and stamp images come from company settings.
                </p>
              </section>
            </LayoutSection>
            <LayoutSection title="Footer">
              {' '}
              <Field label="Document Footer">
                <textarea
                  rows={2}
                  value={style.footer}
                  maxLength={100}
                  onChange={(event) => update('footer', event.target.value)}
                />
              </Field>
            </LayoutSection>
            <div className="paper-format">
              <span>Paper format</span>
              <strong>A4 · Portrait</strong>
              <small>210 × 297 mm</small>
            </div>
          </fieldset>
        </div>
        <div className="designer-preview">
          <div className="designer-preview-heading">
            <span>LIVE PREVIEW</span>
            <span>
              {illustrative || quote.number === 'LAYOUT PREVIEW'
                ? 'Sample content · A4'
                : 'Your quotation · A4'}
            </span>
          </div>
          <DocumentPreview quote={preview} designer />
        </div>
      </div>
      <div className="designer-error">
        <ErrorText>{error}</ErrorText>
      </div>
      <div className="modal-actions designer-actions">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => setStyle(defaultDocumentStyle(quote.company.accent))}
        >
          <RotateCcw size={14} />
          Reset Style
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await downloadQuotation(preview);
            } catch (failure) {
              setError((failure as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <Download size={15} />}Preview PDF
        </button>
        <span className="designer-action-spacer" />
        {onSaveDraft && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                if (!(await onSaveDraft({ document: style, logo, logoWidth })))
                  setError(
                    'Could not save the draft. Check the quotation dates and amounts, or apply this layout and review the error in Quotation details.',
                  );
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save As Draft
          </button>
        )}
        <button type="button" className="button" disabled={busy} onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => onApply({ document: style, logo, logoWidth })}
        >
          Apply Layout
          <Check size={15} />
        </button>
      </div>
    </Modal>
  );
}
