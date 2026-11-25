import { KeyRound, Smartphone } from 'lucide-react';
import { Field } from './ui';
export function TwoFactorCode({
  code,
  onCode,
  recovery,
  onRecovery,
  disabled = false,
  rememberDevice,
  onRememberDevice,
  allowRecovery = true,
}: {
  code: string;
  onCode: (value: string) => void;
  recovery: boolean;
  onRecovery: (value: boolean) => void;
  disabled?: boolean;
  rememberDevice?: boolean;
  onRememberDevice?: (value: boolean) => void;
  allowRecovery?: boolean;
}) {
  return (
    <div className="two-factor-code">
      <Field
        label={recovery ? 'Recovery Code' : 'Authenticator Code'}
        hint={
          recovery
            ? 'Each recovery code can be used once.'
            : 'Enter the 6-digit code from your authenticator app. Used codes cannot be repeated.'
        }
      >
        <input
          value={code}
          onChange={(e) =>
            onCode(recovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          autoComplete="one-time-code"
          inputMode={recovery ? 'text' : 'numeric'}
          maxLength={recovery ? 64 : 6}
          placeholder={recovery ? 'XXXX-XXXX-…' : '000000'}
          spellCheck={false}
          required
          autoFocus
          disabled={disabled}
        />
      </Field>
      {allowRecovery && (
        <button
          type="button"
          className="button ghost small"
          disabled={disabled}
          onClick={() => {
            onRecovery(!recovery);
            onCode('');
          }}
        >
          {recovery ? <Smartphone size={15} /> : <KeyRound size={15} />}{' '}
          {recovery ? 'Use Authenticator App' : 'Use A Recovery Code'}
        </button>
      )}
      {onRememberDevice && (
        <div className="remember-device-option">
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={rememberDevice || false}
              onChange={(event) => onRememberDevice(event.target.checked)}
              disabled={disabled}
            />
            <span>Remember This Device For 1 Week</span>
          </label>
          <small>
            Skip 2FA on this browser for 7 days, including after logout. Your password is still
            required when signing in.
          </small>
        </div>
      )}
    </div>
  );
}
