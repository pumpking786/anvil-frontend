import { useState } from 'react';
import { readIcon } from '../lib/images';
import { ErrorText, Field, Spinner } from './ui';

export function FaviconUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="admin-favicon-upload">
      <Field
        label="Application Icon / Favicon"
        hint="ICO, PNG or SVG · Up to 1 MB. Shared with the Owner Portal when it uses Customization."
      >
        <input
          type="file"
          accept=".ico,.png,.svg,image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setBusy(true);
            setError('');
            try {
              onChange(await readIcon(file));
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Field>
      <div className="favicon-browser-tab">
        <img src={value || '/favicon.svg'} alt="Application icon preview" />
        <span>Business Forge Platform</span>
        {busy && <Spinner />}
      </div>
      {value && (
        <button
          className="text-button muted"
          type="button"
          disabled={busy}
          onClick={() => onChange('')}
        >
          Remove Icon
        </button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
