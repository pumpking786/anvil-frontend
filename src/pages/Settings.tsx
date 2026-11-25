import { ImageFrameControls } from '../components/AppearanceControls';
import { LoginDesigner } from '../components/LoginDesigner';
import { loginBrand, LoginPreview, useLoginLogoFrame } from '../components/LoginPresentation';
import { BrandAppearanceEditor } from '../components/BrandAppearanceEditor';
import { FaviconUpload } from '../components/FaviconUpload';
import { NavigationBrand, useNavigationLogoFrame } from '../components/NavigationBrand';
import { imageFrameStyle, documentImageFrame } from '../domain/appearance';
import { loginBackgroundStyle } from '../lib/theme';
import { useEffect, useState } from 'react';
import { Check, LockKeyhole, Save, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import type { AdminSettings, Company, Quotation, Workspace } from '../domain/types';
import { ErrorText, Field, ImageUpload, NumberInput, Spinner } from '../components/ui';
import { fiscalYearFor, nepaliFiscalYear, nextQuotationNumber } from '../domain/sequence';
import { today, VAT_RATE, VAT_RATE_ERROR, isValidVatRate } from '../domain/quotation';
import { documentPreviewQuote, defaultDocumentStyle } from '../domain/document';
import { DocumentDesigner } from '../components/DocumentDesigner';
export function CompanySettings({
  workspace,
  onSave,
  notify,
  onDirty,
  onPreview,
}: {
  workspace: Workspace;
  onSave: (w: Workspace) => Promise<void>;
  notify: (s: string) => void;
  onDirty: (d: boolean) => void;
  onPreview: (settings: AdminSettings | null) => void;
}) {
  const [company, setCompany] = useState<Company>(() => ({ ...workspace.company }));
  const [settings, setSettings] = useState(() => ({ ...workspace.settings }));
  const navigationFrame = useNavigationLogoFrame(settings);
  const loginFrame = useLoginLogoFrame(loginBrand(company, settings));
  const [loginDesigner, setLoginDesigner] = useState(false);
  useEffect(() => {
    onPreview(settings);
  }, [settings, onPreview]);
  useEffect(() => () => onPreview(null), [onPreview]);
  const [nextNumber, setNextNumber] = useState(() => {
    const suggested = nextQuotationNumber(workspace, today()).split('/').at(-1);
    return Number(suggested) || workspace.nextNumber;
  });
  const [saved, setSaved] = useState(() => JSON.stringify({ company, settings, nextNumber }));
  const [designerQuote, setDesignerQuote] = useState<Quotation | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    // Accept live server updates while this form is clean. An open draft must
    // keep its values and revision until the user saves or discards it.
    if (busy || JSON.stringify({ company, settings, nextNumber }) !== saved) return;
    const next = {
      company: workspace.company,
      settings: workspace.settings,
      nextNumber:
        Number(nextQuotationNumber(workspace, today()).split('/').at(-1)) || workspace.nextNumber,
    };
    const signature = JSON.stringify(next);
    if (signature === saved) return;
    setCompany(next.company);
    setSettings(next.settings);
    setNextNumber(next.nextNumber);
    setSaved(signature);
  }, [workspace, busy, company, settings, nextNumber, saved]);
  useEffect(() => {
    onDirty(JSON.stringify({ company, settings, nextNumber }) !== saved);
    return () => onDirty(false);
  }, [company, settings, nextNumber, saved, onDirty]);
  const companyLogoFrame = documentImageFrame(documentPreviewQuote(company, settings), 'logo');
  const change = (key: keyof Company, value: string) => {
    setCompany((current) => ({ ...current, [key]: value }));
    if (key === 'accent')
      setSettings((current) => ({
        ...current,
        document: current.document ? { ...current.document, primaryColor: value } : undefined,
      }));
  };
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (!isValidVatRate(settings.defaultVatRate ?? VAT_RATE))
          next.defaultVatRate = VAT_RATE_ERROR;
        if (!company.name.trim()) next.name = 'Enter your company name.';
        if (!/^[A-Z0-9_-]{1,12}$/.test(settings.quotePrefix))
          next.quotePrefix = 'Enter a company short form (up to 12 letters or numbers).';
        if (
          !Number.isInteger(settings.validityDays) ||
          settings.validityDays < 1 ||
          settings.validityDays > 365
        )
          next.validityDays = 'Use a whole number from 1 to 365.';
        if (
          !Number.isFinite(settings.lowStockThreshold) ||
          settings.lowStockThreshold < 0 ||
          settings.lowStockThreshold > 1000000
        )
          next.lowStockThreshold = 'Use a number from 0 to 1,000,000.';
        if (settings.fiscalYearOverride && !/^\d{2}-\d{2}$/.test(settings.fiscalYearOverride))
          next.fiscalYearOverride = 'Enter two years as 83-84, or leave it blank.';
        if (!Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 1_000_000_000)
          next.nextNumber = 'Enter a sequence number between 1 and 1,000,000,000.';
        if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email))
          next.email = 'Enter a valid email address.';
        setErrors(next);
        if (Object.keys(next).length) return;
        setBusy(true);
        try {
          const cleaned = { ...company, name: company.name.trim() };
          await onSave({
            ...workspace,
            company: cleaned,
            settings,
            nextNumber,
            sequenceYear: fiscalYearFor({ settings }, today()),
          });
          setCompany(cleaned);
          setSaved(JSON.stringify({ company: cleaned, settings, nextNumber }));
          notify('Company profile saved');
        } catch (err) {
          setErrors({ form: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Customization</h1>
          <p>
            Manage your company identity, quotation defaults, login branding, and document
            appearance.
          </p>
        </div>
        <button className="button primary" disabled={busy}>
          {busy ? <Spinner /> : <Save size={16} />}Save Changes
        </button>
      </div>
      <ErrorText>{errors.form}</ErrorText>
      <section className="panel admin-defaults-panel">
        <div className="panel-heading">
          <h2>Quotation & Inventory Defaults</h2>
          <span>NEW DOCUMENTS</span>
        </div>
        <div className="panel-body">
          <div className="form-grid">
            <Field
              label="Next Quotation Sequence"
              error={errors.nextNumber}
              hint={`Next suggestion: ${settings.quotePrefix}/${fiscalYearFor({ settings }, today())}/${String(nextNumber).padStart(3, '0')}`}
            >
              <NumberInput
                min="1"
                max="1000000000"
                value={nextNumber}
                onValueChange={setNextNumber}
              />
            </Field>
            <Field label={`Default quotation logo width · ${settings.defaultLogoWidth || 132}px`}>
              <input
                type="range"
                min="70"
                max="260"
                step="1"
                value={settings.defaultLogoWidth || 132}
                onChange={(e) =>
                  setSettings({ ...settings, defaultLogoWidth: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field
              label="Company Short Form"
              error={errors.quotePrefix}
              hint="Used in quotation numbers, for example ANV/83-84/001."
            >
              <input
                value={settings.quotePrefix}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    quotePrefix: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9_-]/g, '')
                      .slice(0, 12),
                  })
                }
                maxLength={12}
              />
            </Field>
            <Field
              label="Fiscal Year Label"
              error={errors.fiscalYearOverride}
              hint={`Current calendar year: ${nepaliFiscalYear(today())}. Leave blank to use the Nepali calendar.`}
            >
              <input
                value={settings.fiscalYearOverride || ''}
                placeholder={nepaliFiscalYear(today())}
                maxLength={5}
                inputMode="numeric"
                pattern="[0-9]{2}-[0-9]{2}"
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    fiscalYearOverride: e.target.value.replace(/[^0-9-]/g, '').slice(0, 5),
                    fiscalYearOverrideFor: nepaliFiscalYear(today()),
                  })
                }
              />
            </Field>
            <Field label="Quotation Validity · Days" error={errors.validityDays}>
              <NumberInput
                min="1"
                max="365"
                value={settings.validityDays}
                onValueChange={(validityDays) =>
                  setSettings((current) => ({ ...current, validityDays }))
                }
              />
            </Field>
          </div>
          <div className="form-grid">
            <div className="layout-settings-launch">
              <span className="field-label">Quotation appearance</span>
              <button
                type="button"
                className="button"
                disabled={!isValidVatRate(settings.defaultVatRate ?? VAT_RATE)}
                onClick={() => setDesignerQuote(documentPreviewQuote(company, settings))}
              >
                <SlidersHorizontal size={16} />
                Configure Document Layout
              </button>
              <span className="field-hint">
                Header, tables, fonts, colors and footer. Defaults for new quotations.
              </span>
            </div>
            <Field label="Low Stock Alert At" error={errors.lowStockThreshold}>
              <NumberInput
                min="0"
                value={settings.lowStockThreshold}
                onValueChange={(lowStockThreshold) =>
                  setSettings((current) => ({ ...current, lowStockThreshold }))
                }
              />
            </Field>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={settings.defaultVat}
              onChange={(e) => setSettings({ ...settings, defaultVat: e.target.checked })}
            />
            <span>Enable VAT By Default On New Quotations</span>
          </label>
          <Field
            label="Default VAT Rate (%)"
            error={
              errors.defaultVatRate ||
              (!isValidVatRate(settings.defaultVatRate ?? VAT_RATE) ? VAT_RATE_ERROR : undefined)
            }
            hint="Starts at 13%. Changes apply to new quotations only; saved quotations keep their own rate."
          >
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={
                Number.isNaN(settings.defaultVatRate) ? '' : (settings.defaultVatRate ?? VAT_RATE)
              }
              onChange={(event) => {
                const defaultVatRate = event.target.value === '' ? NaN : Number(event.target.value);
                setSettings((current) => ({ ...current, defaultVatRate }));
              }}
            />
          </Field>
          <p className="field-hint">
            You can change the rate or turn VAT off on each quotation. Every quotation lets you
            choose a document style and logo size.
          </p>
        </div>
      </section>
      <div className="settings-stack">
        <section className="panel">
          <div className="panel-heading">
            <h2>Business Details</h2>
            <span>ON EVERY QUOTATION</span>
          </div>
          <div className="panel-body">
            <div className="company-logo-settings">
              <ImageUpload
                label="Company Logo"
                value={company.logo}
                onChange={(v) => change('logo', v)}
                previewStyle={imageFrameStyle(companyLogoFrame)}
              />
              <ImageFrameControls
                label="Company Logo"
                value={companyLogoFrame}
                minWidth={70}
                maxWidth={260}
                maxHeight={160}
                onChange={(frame) =>
                  setSettings((current) => ({
                    ...current,
                    defaultLogoWidth: frame.width,
                    document: {
                      ...(current.document || defaultDocumentStyle(company.accent)),
                      images: { ...current.document?.images, logo: frame },
                    },
                  }))
                }
              />
              <p className="field-hint">
                Preview the full logo here. Its size and fit become the default for new quotations.
              </p>
            </div>
            <Field label="Company Name *" error={errors.name}>
              <input
                value={company.name}
                onChange={(e) => change('name', e.target.value)}
                autoComplete="organization"
                maxLength={150}
              />
            </Field>
            <Field label="Business Address">
              <textarea
                rows={2}
                value={company.address}
                onChange={(e) => change('address', e.target.value)}
                placeholder="Street, city, Nepal"
                maxLength={500}
              />
            </Field>
            <div className="form-grid">
              <Field label="Phone Number">
                <input
                  type="tel"
                  value={company.phone}
                  onChange={(e) => change('phone', e.target.value)}
                  placeholder="+977"
                  maxLength={40}
                />
              </Field>
              <Field label="Email Address" error={errors.email}>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => change('email', e.target.value)}
                  placeholder="hello@company.com"
                />
              </Field>
            </div>
            <Field
              label="Company Slogan"
              hint="Appears below the two contact lines on your quotations."
            >
              <input
                value={company.slogan ?? 'Forging IT Excellence'}
                onChange={(e) => change('slogan', e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Company VAT / PAN Number">
              <input
                value={company.pan}
                onChange={(e) => change('pan', e.target.value)}
                placeholder="Your business registration number"
                maxLength={30}
              />
            </Field>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Brand Appearance</h2>
          </div>
          <div className="panel-body">
            <p className="section-description">
              These marks appear in the app navigation and browser tab. They are separate from the
              company logo printed on quotations.
            </p>
            <ImageUpload
              label="App Navigation Logo"
              value={settings.appLogo || ''}
              onChange={(appLogo) =>
                setSettings((current) => ({
                  ...current,
                  appLogo,
                  brand: { ...current.brand, navigationLogo: undefined },
                }))
              }
            />
            <div className="navigation-size-settings">
              <Field
                label={`Navigation logo size · ${Math.round(navigationFrame.width)}px wide`}
                hint="Drag to resize the actual sidebar logo. Save changes to keep it."
              >
                <input
                  type="range"
                  min={Math.ceil(
                    Math.max(24, (16 * navigationFrame.width) / navigationFrame.height),
                  )}
                  max={Math.floor(
                    Math.min(190, (160 * navigationFrame.width) / navigationFrame.height),
                  )}
                  step={1}
                  value={navigationFrame.width}
                  onChange={(event) => {
                    const width = Number(event.target.value);
                    const height = (navigationFrame.height * width) / navigationFrame.width;
                    setSettings((current) => ({
                      ...current,
                      appLogoSize: Math.round(Math.min(64, Math.max(24, height))),
                      brand: {
                        ...current.brand,
                        navigationLogo: { ...navigationFrame, width, height },
                      },
                    }));
                  }}
                />
              </Field>
              <Field label={`Navigation text size · ${settings.appTextSize || 11}px`}>
                <input
                  type="range"
                  min={10}
                  max={16}
                  step={1}
                  value={settings.appTextSize || 11}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      appTextSize: Number(event.target.value),
                      ...(current.brand?.navigationTextStyle?.size
                        ? {
                            brand: {
                              ...current.brand,
                              navigationTextStyle: {
                                ...current.brand.navigationTextStyle,
                                size: Number(event.target.value),
                              },
                            },
                          }
                        : {}),
                    }))
                  }
                />
              </Field>
              <div
                className="navigation-brand-preview"
                style={
                  {
                    '--nav-logo-size': `${settings.appLogoSize || 32}px`,
                    '--nav-text-size': `${settings.appTextSize || 11}px`,
                  } as React.CSSProperties
                }
              >
                <NavigationBrand settings={settings} />
              </div>
            </div>
            <FaviconUpload
              value={settings.favicon}
              onChange={(favicon) =>
                setSettings((current) => ({
                  ...current,
                  favicon,
                  brand: { ...current.brand, faviconFit: 'contain', faviconPadding: 0 },
                }))
              }
            />
            <p className="field-hint branding-note">
              Save changes to upload these images to connected Cloudinary storage and update the
              Owner Portal when it uses Customization. Local mode keeps images on this device.
            </p>
            <div className="login-settings-launch">
              <button type="button" className="button" onClick={() => setLoginDesigner(true)}>
                <SlidersHorizontal size={16} />
                Customize Login Page
              </button>
              <p className="field-hint">
                Four layouts, logo proportions, welcome text and colors. Preview changes live.
              </p>
            </div>
            <Field
              label={`Login logo width · ${Math.round(loginFrame.width)}px`}
              hint="Drag to resize instantly. The preview and saved login page use the same size and proportions. Save changes to keep your choice."
            >
              <input
                type="range"
                min={Math.ceil(Math.max(48, (16 * loginFrame.width) / loginFrame.height))}
                max={Math.floor(Math.min(320, (180 * loginFrame.width) / loginFrame.height))}
                step="1"
                value={loginFrame.width}
                onChange={(e) => {
                  const width = Number(e.target.value);
                  setSettings({
                    ...settings,
                    loginLogoWidth: Math.min(260, width),
                    brand: {
                      ...settings.brand,
                      loginLogoFrame: {
                        ...loginFrame,
                        width,
                        height: (loginFrame.height * width) / loginFrame.width,
                      },
                    },
                  });
                }}
              />
            </Field>
            <div
              className="brand-preview"
              style={loginBackgroundStyle(
                settings.loginBackground,
                settings.loginBackgroundColor,
                settings.brand,
              )}
            >
              <LoginPreview brand={loginBrand(company, settings)} />
            </div>
            <ImageUpload
              label="Login Page Background Image"
              value={settings.loginBackground || ''}
              onChange={(loginBackground) =>
                setSettings((current) => ({ ...current, loginBackground }))
              }
            />
            <BrandAppearanceEditor settings={settings} company={company} onChange={setSettings} />
            <Field label="Login Background Color">
              <span className="color-control">
                <input
                  aria-label="Login Background Color"
                  type="color"
                  value={settings.loginBackgroundColor || '#174A78'}
                  onChange={(e) =>
                    setSettings({ ...settings, loginBackgroundColor: e.target.value })
                  }
                />
                <span>{(settings.loginBackgroundColor || '#174A78').toUpperCase()}</span>
              </span>
            </Field>
            <Field
              label="Quotation Accent Color"
              hint="Applied to new quotation documents. The app uses Anvil blue."
            >
              <span className="color-control">
                <input
                  aria-label="Quotation Accent Color"
                  type="color"
                  value={company.accent}
                  onChange={(e) => change('accent', e.target.value)}
                />
                <span>{company.accent.toUpperCase()}</span>
              </span>
            </Field>
            <div className="color-presets">
              {['#174A78', '#101820', '#20384D', '#2B5C8A', '#536779', '#27384A'].map((c) => (
                <button
                  type="button"
                  key={c}
                  style={{ background: c }}
                  aria-label={`Use accent ${c}`}
                  onClick={() => change('accent', c)}
                >
                  {company.accent === c && <Check size={14} />}
                </button>
              ))}
            </div>
            <p className="field-hint">
              Your preview updates immediately. Save changes to keep the design for your next
              sign-in.
            </p>
            <p className="field-hint branding-note">
              <LockKeyhole size={14} />
              Your name, logos and background are visible on the login page. Customer and quotation
              data stay private.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Signature & Stamp</h2>
            <span>THE FINISHING TOUCH</span>
          </div>
          <div className="panel-body">
            <p className="section-description">
              Use a transparent PNG for a clean finish on your printed quotations.
            </p>
            <div className="signature-uploads">
              <ImageUpload
                label="Signature"
                value={company.signature}
                onChange={(v) => change('signature', v)}
              />
              <ImageUpload
                label="Company Stamp"
                value={company.stamp}
                onChange={(v) => change('stamp', v)}
              />
            </div>
            <Field label="Signatory Name Or Title">
              <input
                value={company.signatory}
                onChange={(e) => change('signatory', e.target.value)}
                maxLength={100}
              />
            </Field>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Default Terms & Conditions</h2>
          </div>
          <div className="panel-body">
            <Field
              label="Prefilled On Every New Quotation"
              hint="You can edit these separately on each quotation."
            >
              <textarea
                rows={6}
                value={company.terms}
                onChange={(e) => change('terms', e.target.value)}
                maxLength={10000}
              />
            </Field>
          </div>
        </section>
        <div className="editor-tip">
          <ShieldCheck size={20} />
          <div>
            <strong>Existing quotations stay consistent.</strong>
            <p>
              Branding changes apply to new quotations. Previously saved documents preserve the
              company details they were prepared with.
            </p>
          </div>
        </div>
      </div>
      {loginDesigner && (
        <LoginDesigner
          company={company}
          settings={settings}
          onClose={() => setLoginDesigner(false)}
          onApply={(next) => {
            setSettings(next);
            setLoginDesigner(false);
          }}
        />
      )}
      {designerQuote && (
        <DocumentDesigner
          quote={designerQuote}
          onClose={() => setDesignerQuote(null)}
          onApply={({ document, logo, logoWidth }) => {
            setSettings((current) => ({ ...current, document, defaultLogoWidth: logoWidth }));
            setCompany((current) => ({ ...current, logo, accent: document.primaryColor }));
            setDesignerQuote(null);
          }}
        />
      )}
    </form>
  );
}
