import { useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { ErrorText, Field, Spinner } from './ui';

export function RequiredPasswordChange({
  onChange,
  onCancel,
}: {
  onChange: (current: string, next: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return (
    <>
      <h2>Choose A New Password</h2>
      <p className="login-description">
        Replace your temporary password to continue. Use at least 12 characters.
      </p>
      <form
        className="required-password-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current) return;
          setError('');
          if (next.length < 12 || next.length > 256) {
            setError('Use 12–256 characters for your new password.');
            return;
          }
          if (next !== confirm) {
            setError('The new passwords do not match.');
            return;
          }
          if (current === next) {
            setError('Choose a password different from your temporary password.');
            return;
          }
          pending.current = true;
          setBusy(true);
          try {
            await onChange(current, next);
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <Field label="Temporary Password">
            <input
              autoFocus
              required
              type={show ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              maxLength={256}
            />
          </Field>
          <Field label="New Password">
            <input
              required
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
            />
          </Field>
          <Field label="Confirm New Password">
            <input
              required
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              maxLength={256}
            />
          </Field>
          <div className="password-change-options">
            <button type="button" className="button ghost" onClick={() => setShow(!show)}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
              {show ? 'Hide Passwords' : 'Show Passwords'}
            </button>
            <button type="button" className="button ghost" onClick={onCancel}>
              Back To Sign In
            </button>
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="button primary login-submit" disabled={busy}>
            {busy ? <Spinner /> : <ArrowRight size={17} />}Change Password & Continue
          </button>
        </fieldset>
      </form>
    </>
  );
}
