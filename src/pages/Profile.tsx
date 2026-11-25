import { ProfileEmailTemplates, type EmailPreferences } from '../components/ProfileEmailTemplates';
import { useEffect, useState } from 'react';
import { Save, ShieldCheck, UserRound } from 'lucide-react';
import type { WorkspaceUser } from '../domain/types';
import { Avatar, ErrorText, Field, ImageUpload, Spinner } from '../components/ui';

export type ProfileDetails = Pick<
  WorkspaceUser,
  'name' | 'photo' | 'phone' | 'jobTitle' | 'contactEmail'
>;
export function Profile({
  user,
  isRemote,
  onSave,
  onSaveEmail,
  onDirty,
  notify,
}: {
  user: WorkspaceUser;
  isRemote: boolean;
  onSave: (details: ProfileDetails) => Promise<void>;
  onSaveEmail: (value: EmailPreferences) => Promise<void>;
  onDirty: (dirty: boolean) => void;
  notify: (message: string) => void;
}) {
  const [profile, setProfile] = useState<ProfileDetails>({
    name: user.name,
    photo: user.photo || '',
    phone: user.phone || '',
    jobTitle: user.jobTitle || '',
    contactEmail: user.contactEmail ?? user.email,
  });
  const [changed, setChanged] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    onDirty(changed || emailDirty || busy);
  }, [changed, emailDirty, busy, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  function update(field: keyof ProfileDetails, value: string) {
    setProfile((previous) => ({ ...previous, [field]: value }));
    setChanged(true);
  }
  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>My Profile</h1>
          <p>Your personal details, email templates, and signature.</p>
        </div>
      </div>
      <div className="profile-layout">
        <aside className="profile-summary">
          <Avatar name={profile.name} photo={profile.photo} />
          <h2>{profile.name || 'Your Name'}</h2>
          <p>{profile.jobTitle || 'Team Member'}</p>
          <span className="profile-role">
            <ShieldCheck size={14} />
            {user.role === 'super_admin' ? 'Super Admin' : 'User'}
          </span>
          <dl>
            <dt>Sign-In Email</dt>
            <dd>{user.email}</dd>
            <dt>Workspace</dt>
            <dd>{isRemote ? 'Connected API' : 'Local Workspace'}</dd>
          </dl>
          <p className="profile-note">
            Your administrator manages your workspace role. Your password is private to you.
          </p>
        </aside>
        <div className="profile-forms">
          <form
            className="profile-panel"
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              const invalid: Record<string, string> = {};
              if (!profile.name.trim()) invalid.name = 'Enter your full name.';
              if (
                profile.contactEmail?.trim() &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contactEmail.trim())
              )
                invalid.contactEmail = 'Enter a valid contact email.';
              setErrors(invalid);
              if (Object.keys(invalid).length) return;
              setBusy(true);
              try {
                await onSave({
                  ...profile,
                  name: profile.name.trim(),
                  contactEmail: profile.contactEmail?.trim(),
                  phone: profile.phone?.trim(),
                  jobTitle: profile.jobTitle?.trim(),
                });
                setChanged(false);
                notify('Profile updated');
              } catch (error) {
                setErrors({ save: (error as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="profile-panel-heading">
              <UserRound size={19} />
              <div>
                <h2>Personal Details</h2>
                <p>Keep your team profile up to date.</p>
              </div>
            </div>
            <fieldset disabled={!!busy}>
              <ImageUpload
                label="Profile Photo"
                value={profile.photo || ''}
                onChange={(photo) => update('photo', photo)}
                round
              />
              <div className="form-grid">
                <Field label="Full Name" error={errors.name}>
                  <input
                    autoComplete="name"
                    maxLength={150}
                    value={profile.name}
                    onChange={(event) => update('name', event.target.value)}
                    required
                  />
                </Field>
                <Field label="Job Title">
                  <input
                    autoComplete="organization-title"
                    maxLength={150}
                    value={profile.jobTitle}
                    onChange={(event) => update('jobTitle', event.target.value)}
                    placeholder="e.g. Sales executive"
                  />
                </Field>
                <Field
                  label="Contact Email"
                  error={errors.contactEmail}
                  hint="For your team profile; your sign-in email stays the same."
                >
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={profile.contactEmail}
                    onChange={(event) => update('contactEmail', event.target.value)}
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={profile.phone}
                    onChange={(event) => update('phone', event.target.value)}
                  />
                </Field>
              </div>
              <ErrorText>{errors.save}</ErrorText>
              <div className="profile-actions">
                <button className="button primary" disabled={!!busy || !changed}>
                  {busy ? <Spinner /> : <Save size={16} />}Save Profile
                </button>
              </div>
            </fieldset>
          </form>
          <ProfileEmailTemplates user={user} onSave={onSaveEmail} onDirty={setEmailDirty} />
        </div>
      </div>
    </div>
  );
}
