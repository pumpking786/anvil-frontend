import { platformLabel } from '../lib/appName';
import { useEffect, useRef, useState } from 'react';
import { Image, Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import { masterRequest } from '../lib/master';
import {
  publishInstallationBrand,
  effectiveInstallationBrand,
  useInstallationBrand,
  type InstallationBrand,
} from '../lib/installationBrand';
import { ErrorText, Field, Spinner } from './ui';
import { readImage, readIcon } from '../lib/images';
import { OwnerLogo } from './OwnerLogo';
export function OwnerBrandSettings({
  onPreview,
}: {
  onPreview: (
    value:
      | Pick<
          InstallationBrand,
          'ownerLogo' | 'ownerLogoWidth' | 'ownerAppName' | 'ownerAppSubtitle'
        >
      | undefined,
  ) => void;
}) {
  const published = useInstallationBrand();
  const [saved, setSaved] = useState<InstallationBrand>();
  const [favicon, setFavicon] = useState('');
  const [ownerLogo, setOwnerLogo] = useState('');
  const [ownerLogoWidth, setOwnerLogoWidth] = useState(140);
  const [ownerAppName, setOwnerAppName] = useState('Anvil Technologies');
  const [ownerAppSubtitle, setOwnerAppSubtitle] = useState('Business Forge Platform');
  const [useWorkspaceBranding, setUseWorkspaceBranding] = useState(true);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setBusy('load');
    masterRequest('/branding')
      .then((value: InstallationBrand) => {
        if (active) {
          setSaved(value);
          setFavicon(value.favicon);
          setOwnerLogo(value.ownerLogo || '');
          setOwnerLogoWidth(value.ownerLogoWidth || 140);
          setOwnerAppName(value.ownerAppName || 'Anvil Technologies');
          setOwnerAppSubtitle(platformLabel(value.ownerAppSubtitle));
          setUseWorkspaceBranding(value.useWorkspaceBranding);
          setError('');
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const effective = saved
    ? effectiveInstallationBrand({
        ...saved,
        workspaceBrand:
          published.useWorkspaceBranding && published.workspaceAvailable
            ? published
            : saved.workspaceBrand,
        favicon,
        ownerLogo,
        ownerLogoWidth,
        ownerAppName,
        ownerAppSubtitle,
        useWorkspaceBranding,
      })
    : undefined;
  const dirty =
    !!saved &&
    (saved.favicon !== favicon ||
      saved.ownerLogo !== ownerLogo ||
      saved.ownerLogoWidth !== ownerLogoWidth ||
      saved.ownerAppName !== ownerAppName ||
      saved.ownerAppSubtitle !== ownerAppSubtitle ||
      saved.useWorkspaceBranding !== useWorkspaceBranding);
  useEffect(() => {
    if (saved && !dirty && !busy && published.version > saved.version)
      setReload((value) => value + 1);
  }, [published.version, saved?.version, dirty, busy]);
  useEffect(() => {
    onPreview(
      dirty && effective
        ? {
            ownerLogo: effective.ownerLogo,
            ownerLogoWidth: effective.ownerLogoWidth,
            ownerAppName: effective.ownerAppName,
            ownerAppSubtitle: effective.ownerAppSubtitle,
          }
        : undefined,
    );
  }, [
    dirty,
    effective?.ownerLogo,
    effective?.ownerLogoWidth,
    effective?.ownerAppName,
    effective?.ownerAppSubtitle,
    onPreview,
  ]);
  useEffect(() => () => onPreview(undefined), [onPreview]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || busy === 'save') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  return (
    <section className="panel owner-brand-settings">
      <div className="panel-heading">
        <h2>
          <Image size={18} />
          Owner Portal Branding
        </h2>
        <span className="mini-tag">ALL PORTALS</span>
      </div>
      <form
        className="panel-body"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!saved || lock.current || busy) return;
          lock.current = true;
          setBusy('save');
          setError('');
          setNotice('');
          try {
            const next = (await masterRequest(
              '/branding',
              {
                ...(favicon !== saved.favicon ? { favicon } : {}),
                ...(ownerLogo !== saved.ownerLogo ? { ownerLogo } : {}),
                ...(ownerLogoWidth !== saved.ownerLogoWidth ? { ownerLogoWidth } : {}),
                ...(ownerAppName !== saved.ownerAppName ? { ownerAppName } : {}),
                ...(ownerAppSubtitle !== saved.ownerAppSubtitle ? { ownerAppSubtitle } : {}),
                ...(useWorkspaceBranding !== saved.useWorkspaceBranding
                  ? { useWorkspaceBranding }
                  : {}),
                version: saved.version,
              },
              'PUT',
            )) as InstallationBrand;
            setSaved(next);
            setFavicon(next.favicon);
            setOwnerLogo(next.ownerLogo);
            setOwnerLogoWidth(next.ownerLogoWidth);
            setOwnerAppName(next.ownerAppName || 'Anvil Technologies');
            setOwnerAppSubtitle(platformLabel(next.ownerAppSubtitle));
            publishInstallationBrand(next);
            setNotice('Owner branding saved. Your app name, subtitle and images are up to date.');
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            lock.current = false;
            setBusy('');
          }
        }}
      >
        <Field label="Owner App Name" hint="Shown in the Owner Portal and owner sign-in dialog.">
          <input
            value={ownerAppName}
            onChange={(event) => setOwnerAppName(event.target.value)}
            maxLength={80}
            minLength={2}
            required
            disabled={!!busy || !saved}
          />
        </Field>
        <Field
          label="Owner App Subtitle"
          hint="Change the ‘Business Forge Platform’ text shown below the app name in the Owner Portal and Owner sign-in."
        >
          <input
            value={ownerAppSubtitle}
            onChange={(event) => setOwnerAppSubtitle(event.target.value)}
            maxLength={100}
            minLength={2}
            required
            disabled={!!busy || !saved}
          />
        </Field>
        <label className="owner-brand-source">
          <input
            type="checkbox"
            checked={useWorkspaceBranding}
            disabled={!!busy || !saved}
            onChange={(event) => {
              setUseWorkspaceBranding(event.target.checked);
              setNotice('');
            }}
          />
          <span>
            <strong>Use Customization Images</strong>
            <small>
              Keep the owner header, owner login logo and browser icon in sync with the workspace.
              Images upload to Cloudinary when connected.
            </small>
          </span>
        </label>
        {useWorkspaceBranding ? (
          <div className="owner-shared-brand-preview">
            <div>
              <span className="field-label">Owner header logo</span>
              <OwnerLogo
                src={effective?.ownerLogo || ''}
                width={effective?.ownerLogoWidth || 140}
              />
            </div>
            <div>
              <span className="field-label">Owner login logo</span>
              <OwnerLogo
                src={effective?.ownerLoginLogo || effective?.ownerLogo || ''}
                width={Math.min(260, effective?.ownerLoginLogoWidth || 140)}
              />
            </div>
            <div>
              <span className="field-label">Browser icon</span>
              <img
                width="32"
                height="32"
                src={effective?.favicon || '/favicon.svg'}
                alt="Shared browser icon"
              />
            </div>
            <p className="field-hint">
              {saved?.workspaceBrand
                ? 'Upload or replace these images in Customization → Brand appearance, then save changes. The company logo is the logo fallback; your saved owner favicon is used until you add a workspace icon.'
                : 'Connect and save your workspace to share its branding. Until then, your saved owner branding is used.'}
            </p>
          </div>
        ) : (
          <div className="owner-brand-grid">
            <div className="owner-brand-section">
              <h3>Owner Portal Logo</h3>
              <p className="section-description">
                Shown in the owner header and owner sign-in page. Resize it below; rectangular logos
                keep their proportions.
              </p>
              <Field label="Upload Owner Logo" hint="PNG, JPG or WebP · Up to 5 MB">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={!!busy || !saved}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file || lock.current) return;
                    lock.current = true;
                    setBusy('logo');
                    setError('');
                    setNotice('');
                    try {
                      setOwnerLogo(await readImage(file));
                    } catch (cause) {
                      setError((cause as Error).message);
                    } finally {
                      lock.current = false;
                      setBusy('');
                    }
                  }}
                />
              </Field>
              <Field label={`Logo width · ${ownerLogoWidth} px`}>
                <input
                  type="range"
                  aria-label="Owner Logo Width"
                  min="40"
                  max="260"
                  step="1"
                  value={ownerLogoWidth}
                  disabled={!!busy || !saved || !ownerLogo}
                  onChange={(event) => {
                    setOwnerLogoWidth(Number(event.target.value));
                    setNotice('');
                  }}
                />
              </Field>
              <div className="owner-logo-preview" aria-label="Owner Logo Preview">
                <span className="field-label">Live preview</span>
                <div className="master-console-brand">
                  <OwnerLogo src={ownerLogo} width={ownerLogoWidth} />
                  <div>
                    <strong>{ownerAppName || 'Anvil Technologies'}</strong>
                    <span>{ownerAppSubtitle || 'Business Forge Platform'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="text-button"
                disabled={!!busy || !ownerLogo}
                onClick={() => {
                  setOwnerLogo('');
                  setNotice('');
                }}
              >
                <RotateCcw size={15} />
                Use Default Logo
              </button>
            </div>
            <div className="owner-brand-section">
              <h3>Application Favicon</h3>
              <p className="section-description">
                Shown in browser tabs across all portals and workspaces. Updates appear without
                clearing the browser cache.
              </p>
              <Field
                label="Upload Favicon"
                hint="ICO, PNG or SVG · Up to 1 MB. Square artwork works best; rectangular images keep their proportions."
              >
                <input
                  type="file"
                  accept=".ico,.png,.svg,image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                  disabled={!!busy || !saved}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file || lock.current) return;
                    lock.current = true;
                    setBusy('image');
                    setError('');
                    setNotice('');
                    try {
                      setFavicon(await readIcon(file));
                    } catch (cause) {
                      setError((cause as Error).message);
                    } finally {
                      lock.current = false;
                      setBusy('');
                    }
                  }}
                />
              </Field>
              <div className="favicon-preview" aria-label="Favicon Preview">
                <div className="favicon-browser-tab">
                  <img src={favicon || '/favicon.svg'} alt="Browser tab icon preview" />
                  <span>
                    {ownerAppName || 'Anvil Technologies'} ·{' '}
                    {ownerAppSubtitle || 'Business Forge Platform'}
                  </span>
                </div>
                <div className="favicon-sizes">
                  {[16, 32, 64].map((size) => (
                    <div key={size}>
                      <img
                        src={favicon || '/favicon.svg'}
                        width={size}
                        height={size}
                        alt={`${size} pixel preview`}
                      />
                      <small>{size} px</small>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="text-button"
                disabled={!!busy || !saved || !favicon}
                onClick={() => {
                  setFavicon('');
                  setNotice('');
                }}
              >
                <RotateCcw size={15} />
                Use Default Icon
              </button>
            </div>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        {notice && (
          <p className="email-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}
        <div className="connection-actions">
          <button className="button primary" disabled={!!busy || !dirty}>
            {busy ? <Spinner /> : <Save size={16} />}Save Branding
          </button>
          <button
            type="button"
            className="button"
            disabled={!!busy || !saved || !dirty}
            onClick={() => {
              if (!saved) return;
              setFavicon(saved.favicon);
              setOwnerLogo(saved.ownerLogo);
              setOwnerLogoWidth(saved.ownerLogoWidth);
              setOwnerAppName(saved.ownerAppName || 'Anvil Technologies');
              setOwnerAppSubtitle(platformLabel(saved.ownerAppSubtitle));
              setUseWorkspaceBranding(saved.useWorkspaceBranding);
              setNotice('');
            }}
          >
            <RotateCcw size={16} />
            Discard Changes
          </button>
          {error && (
            <button
              type="button"
              className="button"
              disabled={!!busy}
              onClick={() => {
                if (!dirty || confirm('Discard unsaved branding changes and reload?'))
                  setReload((value) => value + 1);
              }}
            >
              Reload Branding Settings
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
