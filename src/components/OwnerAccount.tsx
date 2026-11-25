import { ThemeControl } from './ThemeControl';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Modal } from './ui';
import { TwoFactorSettings } from './TwoFactorSettings';

export function OwnerProfile({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <Modal
      title="My Profile"
      subtitle="Your installation-owner identity"
      onClose={onClose}
      className="owner-profile-modal"
    >
      <div className="owner-profile-content">
        <span className="owner-profile-avatar" aria-hidden="true">
          <ShieldCheck size={30} />
        </span>
        <h3>Installation Owner</h3>
        <dl>
          <dt>Registered Email</dt>
          <dd>{email}</dd>
          <dt>Access</dt>
          <dd>Installation and workspace administration</dd>
        </dl>
        <p>
          Your owner identity is separate from workspace user profiles. Password and authentication
          options are in Settings.
        </p>
      </div>
    </Modal>
  );
}

export function OwnerSettings({
  required,
  onClose,
  onPassword,
  onDirty,
  onReset,
}: {
  required?: boolean;
  onClose: () => void;
  onPassword: () => void;
  onDirty: (value: boolean) => void;
  onReset: () => void;
}) {
  return (
    <Modal
      title="Settings"
      subtitle="Your owner account security"
      onClose={onClose}
      className="owner-settings-modal"
    >
      <div className="owner-settings-content profile-forms">
        <ThemeControl />
        <section className="profile-panel">
          <div className="profile-panel-heading">
            <KeyRound size={19} />
            <div>
              <h2>Password</h2>
              <p>Update the password for your installation-owner account.</p>
            </div>
          </div>
          <button type="button" className="button" onClick={onPassword}>
            <KeyRound size={16} />
            Change Password
          </button>
        </section>
        <TwoFactorSettings kind="master" required={required} onDirty={onDirty} onReset={onReset} />
      </div>
    </Modal>
  );
}
