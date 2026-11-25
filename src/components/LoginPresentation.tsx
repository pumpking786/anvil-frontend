import { ThemeLogo } from './ThemeLogo';
import { ThemeToggle } from './ThemeControl';
import { platformLabel } from '../lib/appName';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Branding, ImageFrame, AdminSettings, Company } from '../domain/types';
import { loginLogoStyle } from '../domain/appearance';
import { ANVIL_ACCENT, contrastText, loginBackgroundStyle, readableAccent } from '../lib/theme';
import { LoginDialog, type LoginDialogOptions } from './LoginDialog';

export const LOGIN_LAYOUTS = [
  { id: 'classic', name: 'Classic', description: 'A familiar centered card' },
  { id: 'split', name: 'Split', description: 'Brand panel and focused sign-in' },
  { id: 'banner', name: 'Banner', description: 'A signature header above the form' },
  { id: 'minimal', name: 'Minimal', description: 'Quiet lines and generous space' },
] as const;

/** Lightweight vector artwork: sharp at every size and independent of uploaded branding. */
function LoginArtwork() {
  const gradient = useId();
  return (
    <svg className="login-artwork" viewBox="0 0 480 480" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={gradient}
          x1="80"
          y1="80"
          x2="380"
          y2="400"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity=".85" />
          <stop offset=".5" stopColor="white" stopOpacity=".24" />
          <stop offset="1" stopColor="white" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <g className="login-artwork-rings" stroke="white" strokeOpacity=".13">
        <circle cx="240" cy="240" r="208" />
        <circle cx="240" cy="240" r="164" />
        <path d="M0 240H480M240 0V480" strokeDasharray="3 9" />
      </g>
      <g className="login-artwork-ribbons" stroke={`url(#${gradient})`} strokeWidth="1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((line) => (
          <path
            key={line}
            d={`M${76 + line * 12} ${252 + line * 12}L240 ${88 + line * 12}L${404 - line * 12} ${252 + line * 12}L240 ${416 - line * 12}Z`}
          />
        ))}
      </g>
      <circle cx="240" cy="32" r="5" fill="white" fillOpacity=".8" />
      <circle cx="448" cy="240" r="3" fill="white" fillOpacity=".5" />
    </svg>
  );
}
export function loginBrand(company: Company, settings: AdminSettings): Branding {
  return {
    name: company.name,
    logo: company.logo,
    accent: company.accent,
    appLogo: settings.appLogo,
    favicon: settings.favicon,
    appearance: settings.brand,
    loginLogoWidth: settings.loginLogoWidth || 150,
    loginBackground: settings.loginBackground,
    loginBackgroundColor: settings.loginBackgroundColor,
  };
}
export function useLoginLogoFrame(
  brand: Pick<Branding, 'logo' | 'appearance' | 'loginLogoWidth'>,
): ImageFrame {
  const src = brand.appearance?.loginLogo || brand.logo;
  const [imageSize, setImageSize] = useState({ src: '', ratio: 3 });
  useEffect(() => {
    if (!src) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active && img.naturalHeight)
        setImageSize({ src, ratio: img.naturalWidth / img.naturalHeight });
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  if (brand.appearance?.loginLogoFrame) return brand.appearance.loginLogoFrame;
  const width = brand.loginLogoWidth || 150;
  const ratio = imageSize.src === src ? imageSize.ratio : 3;
  return {
    width,
    height: Math.max(16, Math.min(180, width / ratio)),
    fit: 'contain',
    position: 'center',
  };
}
export function LoginPresentation({
  brand,
  preview = false,
  dialog,
  children,
}: {
  brand: Branding;
  preview?: boolean;
  dialog?: LoginDialogOptions;
  children: ReactNode;
}) {
  const layout = LOGIN_LAYOUTS.some((item) => item.id === brand.appearance?.loginLayout)
    ? brand.appearance!.loginLayout
    : 'classic';
  const accent = brand.appearance?.loginAccent || ANVIL_ACCENT;
  const frame = useLoginLogoFrame(brand);
  const Surface = preview ? 'div' : 'main';
  // The original Anvil navy remains available from the color picker, while a
  // quieter neutral is the more welcoming default for the refreshed login.
  const loginBgColor =
    brand.loginBackgroundColor?.toLowerCase() === '#174a78'
      ? '#eef3f8'
      : brand.loginBackgroundColor || '#eef3f8';
  return (
    <div className="login-render-surface">
      {!preview && (
        <div className="login-theme-control">
          <ThemeToggle />
        </div>
      )}
      <Surface
        className={`login login-layout-${layout} ${brand.loginBackground ? 'has-background-image' : ''} ${preview ? 'is-preview' : ''} ${dialog ? 'has-auth-dialog' : ''}`}
        style={
          {
            ...loginBackgroundStyle(brand.loginBackground || '', loginBgColor, brand.appearance),
            '--accent': accent,
            '--accent-ink': contrastText(accent),
            '--accent-readable': readableAccent(accent),
            '--login-brand-accent': accent,
            '--login-card-height': `${Math.max(580, (brand.appearance?.loginLogo || brand.logo ? frame.height : 0) + 534)}px`,
            '--login-footer-ink': brand.loginBackground ? '#ffffff' : contrastText(loginBgColor),
          } as React.CSSProperties
        }
      >
        <section
          className="login-form-side"
          inert={!!dialog}
          aria-hidden={dialog ? true : undefined}
        >
          <div className="login-card-layout">
            {(layout === 'split' || layout === 'banner') && (
              <aside className="login-brand-panel">
                <LoginArtwork />
                <span className="login-panel-kicker">
                  {brand.appearance?.loginTitle ?? 'Anvil Technologies'}
                </span>
                <strong>{brand.appearance?.loginTagline ?? 'Forging IT Excellence'}</strong>
                <span className="login-panel-caption">
                  {platformLabel(brand.appearance?.loginSubtitle)}
                </span>
              </aside>
            )}
            <div className="login-form-wrap">
              {(brand.appearance?.loginLogo || brand.logo) && (
                <ThemeLogo
                  className="login-company-logo"
                  fetchPriority="high"
                  loading="eager"
                  style={loginLogoStyle(frame)}
                  src={brand.appearance?.loginLogo || brand.logo}
                  alt={brand.name}
                />
              )}
              {!brand.appearance?.loginLogo && !brand.logo && (
                <div className="login-brand-fallback" aria-label={brand.name}>
                  <span aria-hidden="true">{brand.name?.trim().charAt(0) || 'A'}</span>
                  <strong>{brand.name || 'Anvil Technologies'}</strong>
                </div>
              )}
              {!dialog && children}
            </div>
          </div>
          <div className="login-bottom">
            <span>Forging IT Excellence</span>
            <span>Secure workspace access</span>
          </div>
        </section>
      </Surface>
      {dialog && (
        <LoginDialog key={dialog.title} brand={brand} frame={frame} {...dialog}>
          {children}
        </LoginDialog>
      )}
    </div>
  );
}
export function LoginPreview({ brand }: { brand: Branding }) {
  const outer = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.5, height: 320 });
  useLayoutEffect(() => {
    const resize = () => {
      if (!outer.current || !canvas.current) return;
      const scale = Math.min(1, outer.current.clientWidth / 1000);
      const height = canvas.current.offsetHeight * scale;
      setSize((prev) =>
        Math.abs(prev.scale - scale) < 0.001 && Math.abs(prev.height - height) < 1
          ? prev
          : { scale, height },
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(outer.current!);
    observer.observe(canvas.current!);
    resize();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="login-preview-viewport" ref={outer} style={{ height: size.height }}>
      <div
        ref={canvas}
        className="login-preview-canvas"
        style={{ transform: `scale(${size.scale})` }}
      >
        <LoginPresentation brand={brand} preview>
          <h2>{brand.appearance?.loginHeading ?? 'Welcome Back'}</h2>
          <p className="login-description">
            {brand.appearance?.loginMessage ?? 'Sign in to your workspace.'}
          </p>
          <div className="field">
            <span className="field-label">Email address</span>
            <div className="login-preview-input">you@company.com</div>
          </div>
          <div className="field">
            <span className="field-label">Password</span>
            <div className="login-preview-input">••••••••••••</div>
          </div>
          <div className="button primary login-submit">
            Sign in to workspace <ArrowRight size={17} />
          </div>
          <div className="login-security">
            <ShieldCheck size={18} />
            <span>Secure workspace access</span>
          </div>
        </LoginPresentation>
      </div>
    </div>
  );
}
