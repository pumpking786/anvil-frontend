import { Moon, Sun, Monitor } from 'lucide-react';
import { useColorScheme, setColorScheme } from '../lib/colorScheme';
export function ThemeToggle() {
  const preference = useColorScheme();
  const dark =
    preference === 'dark' ||
    (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const label = dark ? 'Switch To Light Theme' : 'Switch To Dark Theme';
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
export function ThemeControl() {
  const preference = useColorScheme();
  return (
    <section className="theme-settings">
      <div>
        <h2>Appearance</h2>
        <p>Choose your theme for this browser. Quotation documents keep their print colors.</p>
      </div>
      <div className="view-switcher" role="group" aria-label="Color Theme">
        {(
          [
            { value: 'light', label: 'Light', Icon: Sun },
            { value: 'dark', label: 'Dark', Icon: Moon },
            { value: 'system', label: 'System', Icon: Monitor },
          ] as const
        ).map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={preference === value}
            onClick={() => setColorScheme(value)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
