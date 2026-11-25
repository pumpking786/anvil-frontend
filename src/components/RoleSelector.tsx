import { useId } from 'react';
import { ShieldCheck, UserRound, Check } from 'lucide-react';
import type { WorkspaceRole } from '../domain/types';
export function RoleSelector({
  value,
  onChange,
  label = 'Role',
  disabled = false,
  compact = false,
}: {
  value: WorkspaceRole;
  onChange: (role: WorkspaceRole) => void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const groupId = useId();
  return (
    <fieldset className={`role-selector ${compact ? 'compact' : ''}`} disabled={disabled}>
      <legend className={compact ? 'sr-only' : 'field-label'}>{label}</legend>
      <div className="role-options">
        {(
          [
            {
              value: 'user',
              title: 'User',
              description: 'Customers, quotations, products & CRM',
              Icon: UserRound,
            },
            {
              value: 'super_admin',
              title: 'Super Admin',
              description: 'Full workspace, settings & user access',
              Icon: ShieldCheck,
            },
          ] as const
        ).map((role) => (
          <label
            key={role.value}
            className={`role-choice role-choice-${role.value} ${value === role.value ? 'selected' : ''}`}
            title={role.description}
          >
            <input
              type="radio"
              aria-label={`${label}: ${role.title}`}
              name={groupId}
              value={role.value}
              checked={value === role.value}
              onChange={() => onChange(role.value)}
            />
            <role.Icon size={compact ? 15 : 20} />
            <span>
              <strong>{role.title}</strong>
              {!compact && <small>{role.description}</small>}
            </span>
            {value === role.value && <Check size={13} />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
