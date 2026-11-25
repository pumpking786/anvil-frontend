import { platformLabel } from '../lib/appName';
import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { AdminSettings, BrandAppearance, Company } from '../domain/types';
import { Field, ImageUpload, Modal } from './ui';
import { ImageFrameControls } from './AppearanceControls';
import { loginBrand, LOGIN_LAYOUTS, LoginPreview, useLoginLogoFrame } from './LoginPresentation';

export function LoginLogoControls({
  settings,
  company,
  onChange,
}: {
  settings: AdminSettings;
  company: Company;
  onChange: (settings: AdminSettings) => void;
}) {
  const frame = useLoginLogoFrame(loginBrand(company, settings));
  const [locked, setLocked] = useState(true);
  return (
    <>
      <ImageUpload
        label="Dedicated Login Logo"
        value={settings.brand?.loginLogo || ''}
        onChange={(logo) =>
          onChange({
            ...settings,
            brand: { ...settings.brand, loginLogo: logo, loginLogoFrame: undefined },
          })
        }
      />
      <p className="field-hint">Uses the company logo when no separate image is uploaded.</p>
      <ImageFrameControls
        label="Login Logo Frame"
        value={frame}
        minWidth={48}
        maxWidth={320}
        maxHeight={180}
        lockAspect={locked}
        onLockAspectChange={setLocked}
        onChange={(loginLogoFrame) =>
          onChange({
            ...settings,
            loginLogoWidth: Math.max(48, Math.min(260, Math.round(loginLogoFrame.width))),
            brand: { ...settings.brand, loginLogoFrame },
          })
        }
      />
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setLocked(true);
          onChange({ ...settings, brand: { ...settings.brand, loginLogoFrame: undefined } });
        }}
      >
        <RotateCcw size={14} />
        Use Original Logo Proportions
      </button>
    </>
  );
}
export function LoginDesigner({
  company,
  settings,
  onClose,
  onApply,
}: {
  company: Company;
  settings: AdminSettings;
  onClose: () => void;
  onApply: (settings: AdminSettings) => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(settings));
  const brand = draft.brand || {};
  const update = <K extends keyof BrandAppearance>(key: K, value: BrandAppearance[K]) =>
    setDraft((current) => ({ ...current, brand: { ...current.brand, [key]: value } }));
  return (
    <Modal
      title="Design Your Login Page"
      subtitle="Choose a layout and preview every change immediately."
      className="login-designer"
      onClose={onClose}
    >
      <div className="login-designer-body">
        <div className="login-design-controls">
          <h3>Choose A Layout</h3>
          <div className="login-layout-options" role="group" aria-label="Login Page Layout">
            {LOGIN_LAYOUTS.map((layout) => (
              <button
                key={layout.id}
                type="button"
                aria-pressed={(brand.loginLayout || 'classic') === layout.id}
                onClick={() => update('loginLayout', layout.id)}
              >
                <span className={`login-layout-thumb thumb-${layout.id}`} aria-hidden="true">
                  <i />
                  <b />
                </span>
                <strong>
                  {layout.name}
                  {(brand.loginLayout || 'classic') === layout.id && <Check size={14} />}
                </strong>
                <small>{layout.description}</small>
              </button>
            ))}
          </div>
          <div className="login-custom-section">
            <h3>Logo Size & Fit</h3>
            <LoginLogoControls settings={draft} company={company} onChange={setDraft} />
          </div>
          <div className="login-custom-section">
            <h3>Identity & Welcome</h3>
            <Field label="Login Company Title">
              <input
                maxLength={100}
                value={brand.loginTitle ?? 'Anvil Technologies'}
                onChange={(e) => update('loginTitle', e.target.value)}
              />
            </Field>
            <Field label="Login Platform Title">
              <input
                maxLength={100}
                value={platformLabel(brand.loginSubtitle)}
                onChange={(e) => update('loginSubtitle', e.target.value)}
              />
            </Field>
            <Field label="Welcome Heading">
              <input
                maxLength={80}
                value={brand.loginHeading ?? 'Welcome back'}
                onChange={(e) => update('loginHeading', e.target.value)}
              />
            </Field>
            <Field label="Welcome Message">
              <textarea
                rows={3}
                maxLength={240}
                value={brand.loginMessage ?? 'Sign in to pick up where you left off.'}
                onChange={(e) => update('loginMessage', e.target.value)}
              />
            </Field>
            <Field label="Brand Panel Slogan" hint="Shown in the Split and Banner layouts.">
              <input
                maxLength={120}
                value={brand.loginTagline ?? 'Forging IT Excellence'}
                onChange={(e) => update('loginTagline', e.target.value)}
              />
            </Field>
            <div className="form-grid">
              <Field label="Login Accent Color">
                <input
                  type="color"
                  value={brand.loginAccent || '#174A78'}
                  onChange={(e) => update('loginAccent', e.target.value)}
                />
              </Field>
              <Field label="Login Background Color">
                <input
                  type="color"
                  value={draft.loginBackgroundColor || '#174A78'}
                  onChange={(e) => setDraft({ ...draft, loginBackgroundColor: e.target.value })}
                />
              </Field>
            </div>
            <ImageUpload
              label="Login Page Background Image"
              value={draft.loginBackground}
              onChange={(loginBackground) => setDraft({ ...draft, loginBackground })}
            />
            <Field label="Background Image Fit">
              <select
                value={brand.backgroundFit || 'cover'}
                onChange={(e) => update('backgroundFit', e.target.value as 'cover' | 'contain')}
              >
                <option value="cover">Fill page</option>
                <option value="contain">Fit entire image</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="login-design-preview">
          <div className="login-preview-heading">
            <strong>LIVE PREVIEW</strong>
            <span>Sign-in page · Changes are not saved yet</span>
          </div>
          <LoginPreview brand={loginBrand(company, draft)} />
          <p className="field-hint">
            The preview uses the same layout, logo dimensions and colors as your sign-in page.
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <span className="field-hint">Apply the design, then save your admin settings.</span>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button primary" onClick={() => onApply(draft)}>
          Apply Login Design <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}
