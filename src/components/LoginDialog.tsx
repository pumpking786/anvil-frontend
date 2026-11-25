import { ThemeLogo } from './ThemeLogo';
import type { CSSProperties, ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Branding, ImageFrame } from '../domain/types';
import { loginLogoStyle } from '../domain/appearance';
import { ANVIL_ACCENT, contrastText, readableAccent } from '../lib/theme';
import { Modal } from './ui';

export type LoginDialogOptions = {
  title: string;
  onClose: () => void;
  enrollment?: boolean;
};

/** A viewport-bound sign-in step, independent of the scrolling login card. */
export function LoginDialog({
  brand,
  frame,
  title,
  onClose,
  enrollment,
  children,
}: LoginDialogOptions & { brand: Branding; frame: ImageFrame; children: ReactNode }) {
  const accent = brand.appearance?.loginAccent || ANVIL_ACCENT;
  const logo = brand.appearance?.loginLogo || brand.logo;
  return (
    <Modal
      title={title}
      onClose={onClose}
      closeLabel={enrollment ? 'Sign Out And Close Enrollment' : 'Close Dialog'}
      className={`auth-dialog ${enrollment ? 'auth-dialog-enrollment' : ''}`}
      backdropClassName="auth-dialog-backdrop"
      style={
        {
          '--accent': accent,
          '--accent-ink': contrastText(accent),
          '--accent-readable': readableAccent(accent),
        } as CSSProperties
      }
    >
      <div className="auth-dialog-content">
        {!enrollment && (
          <div className="auth-dialog-brand auth-dialog-logo">
            {logo ? (
              <ThemeLogo
                src={logo}
                alt={brand.name}
                style={loginLogoStyle(frame)}
                fetchPriority="high"
              />
            ) : (
              <span className="auth-dialog-symbol" aria-hidden="true">
                <ShieldCheck size={23} />
              </span>
            )}
          </div>
        )}
        {children}
      </div>
    </Modal>
  );
}
