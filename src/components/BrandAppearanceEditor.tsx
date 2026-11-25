import { platformLabel } from '../lib/appName';
import type { AdminSettings, BrandAppearance, Company, TextAppearance } from '../domain/types';
import { Field } from './ui';
import { LoginLogoControls } from './LoginDesigner';
import { TextStyleControls, ImageFrameControls } from './AppearanceControls';
import { useState } from 'react';
import { useNavigationLogoFrame } from './NavigationBrand';
export function BrandAppearanceEditor({
  settings,
  company,
  onChange,
}: {
  settings: AdminSettings;
  company: Company;
  onChange: (settings: AdminSettings) => void;
}) {
  const brand = settings.brand || {};
  const navigationFrame = useNavigationLogoFrame(settings);
  const [lockNavigationAspect, setLockNavigationAspect] = useState(true);
  const update = <K extends keyof BrandAppearance>(key: K, value: BrandAppearance[K]) =>
    onChange({ ...settings, brand: { ...brand, [key]: value } });
  const textDefault = (size: number): Required<TextAppearance> => ({
    color: '#174A78',
    font: 'dm-sans',
    size,
    align: 'center',
    bold: true,
    italic: false,
  });
  return (
    <div className="brand-advanced">
      <details open>
        <summary>Navigation Logo & Text</summary>
        <div className="brand-detail-body">
          <Field label="Navigation Brand Text">
            <input
              value={platformLabel(brand.navigationText)}
              maxLength={100}
              onChange={(e) => update('navigationText', e.target.value)}
            />
          </Field>
          <TextStyleControls
            unit="px"
            label="Navigation Brand Text"
            value={brand.navigationTextStyle}
            defaults={textDefault(settings.appTextSize || 11)}
            onChange={(value) => update('navigationTextStyle', value)}
            maxSize={18}
          />
          <ImageFrameControls
            label="Navigation Logo"
            value={navigationFrame}
            maxWidth={190}
            maxHeight={160}
            lockAspect={lockNavigationAspect}
            onLockAspectChange={setLockNavigationAspect}
            onChange={(value) => update('navigationLogo', value)}
          />
          <p className="field-hint">
            Changes appear immediately in the sidebar. Unlock proportions to adjust the frame
            independently.
          </p>
        </div>
      </details>
      <details>
        <summary>Login Identity & Logo</summary>
        <div className="brand-detail-body">
          <Field label="Login Company Title">
            <input
              value={brand.loginTitle ?? 'Anvil Technologies'}
              maxLength={100}
              onChange={(e) => update('loginTitle', e.target.value)}
            />
          </Field>
          <TextStyleControls
            unit="px"
            label="Login Company Title"
            value={brand.loginTitleStyle}
            defaults={textDefault(10)}
            onChange={(value) => update('loginTitleStyle', value)}
            maxSize={28}
          />
          <Field label="Login Platform Title">
            <input
              value={platformLabel(brand.loginSubtitle)}
              maxLength={100}
              onChange={(e) => update('loginSubtitle', e.target.value)}
            />
          </Field>
          <TextStyleControls
            unit="px"
            label="Login Platform Title"
            value={brand.loginSubtitleStyle}
            defaults={textDefault(18)}
            onChange={(value) => update('loginSubtitleStyle', value)}
            maxSize={28}
          />
          <LoginLogoControls settings={settings} company={company} onChange={onChange} />
          {!company.logo && !brand.loginLogo && (
            <p className="field-hint">
              Upload a company or login logo to see these image settings.
            </p>
          )}
        </div>
      </details>
      <details>
        <summary>Background</summary>
        <div className="brand-detail-body">
          <Field label="Login Background Fit">
            <select
              value={brand.backgroundFit || 'cover'}
              onChange={(e) => update('backgroundFit', e.target.value as 'cover' | 'contain')}
            >
              <option value="cover">Fill page (crop)</option>
              <option value="contain">Fit entire image</option>
            </select>
          </Field>
          <Field label="Login Background Position">
            <select
              value={brand.backgroundPosition || 'center'}
              onChange={(e) =>
                update(
                  'backgroundPosition',
                  e.target.value as BrandAppearance['backgroundPosition'],
                )
              }
            >
              {['left', 'center', 'right', 'top', 'bottom'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>
      </details>
    </div>
  );
}
