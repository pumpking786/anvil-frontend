import { useEffect, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import type { CompanyWorkspace, Connection } from '../domain/types';
import { WorkspaceApi } from '../lib/api';
export function CompanySwitcher({
  connection,
  disabled,
  onSelect,
}: {
  connection: Connection;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [companies, setCompanies] = useState<CompanyWorkspace[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const refresh = () =>
      new WorkspaceApi(connection)
        .companies()
        .then((result) => {
          if (live) {
            setCompanies(result);
            setError('');
          }
        })
        .catch(() => {
          if (live) setError('Company List Unavailable');
        });
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [connection.url, connection.workspaceId]);
  const companyId = connection.workspaceId || 'primary';
  const selectedCompany = companies.find((company) => company.id === companyId);
  const unavailable = disabled || !companies.length;
  return (
    <div className="company-switcher">
      <label htmlFor="active-company">
        <Building2 size={14} aria-hidden="true" /> Company Workspace
      </label>
      <div className="company-switcher-control" data-disabled={unavailable}>
        <span className="company-switcher-name" aria-hidden="true">
          {selectedCompany?.name ||
            (companies.length || error ? 'Choose Company' : 'Loading Companies…')}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
        {/* Keep the native keyboard/mobile picker while the visible name can wrap. */}
        <select
          id="active-company"
          value={companyId}
          title={selectedCompany?.name}
          disabled={unavailable}
          onChange={(event) => onSelect(event.target.value)}
        >
          {!selectedCompany && <option value={companyId}>Choose Company</option>}
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>
      {error && <small role="status">{error}</small>}
    </div>
  );
}
