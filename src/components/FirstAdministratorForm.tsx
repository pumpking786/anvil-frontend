import { useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { Field, ErrorText, Spinner } from './ui';
import { masterRequest, type MasterConfiguration } from '../lib/master';

export function FirstAdministratorForm({
  onCreated,
}: {
  onCreated: (value: MasterConfiguration) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="panel first-administrator-panel">
      <div className="panel-heading">
        <h2>
          <KeyRound size={18} /> Create First Workspace Administrator
        </h2>
      </div>
      <form
        className="panel-body"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError('');
          if (password !== confirm) {
            setError('The passwords do not match.');
            return;
          }
          setBusy(true);
          try {
            const result = await masterRequest('/administrator', {
              name: name.trim(),
              email: email.trim(),
              password,
            });
            setPassword('');
            setConfirm('');
            onCreated(result);
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="database-intro">
          Your business records are ready. Create a server login to open the workspace. You can use
          an imported team member’s email to keep their existing profile.
        </p>
        <fieldset disabled={busy} className="administrator-fields">
          <div className="form-grid">
            <Field label="Administrator Name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoComplete="name"
              />
            </Field>
            <Field label="Administrator Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                autoComplete="username"
              />
            </Field>
            <Field label="Administrator Password" hint="At least 12 characters.">
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm Administrator Password">
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
          <button className="button primary">
            {busy ? <Spinner /> : <UserPlus size={17} />}
            {busy ? 'Creating Administrator…' : 'Create Administrator'}
          </button>
        </fieldset>
        <p className="field-hint">
          Other imported users keep their profiles. Set their server passwords in Users &amp; roles
          after signing in. Two-factor setup is required on first sign-in.
        </p>
      </form>
    </section>
  );
}
