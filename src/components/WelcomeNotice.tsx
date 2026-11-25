import { useEffect, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';

export function WelcomeNotice({ name }: { name: string }) {
  const [greeting] = useState(() =>
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 18
        ? 'Welcome back'
        : 'Good evening',
  );
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setVisible(false), 260);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!visible) return null;
  return (
    <aside className={`welcome-notice ${leaving ? 'is-leaving' : ''}`} aria-label="Welcome Message">
      <span className="welcome-symbol" aria-hidden="true">
        <Sparkles size={23} />
        <Check size={11} />
      </span>
      <div role="status">
        <p>
          {greeting}, {name}! ✨
        </p>
        <strong>Let’s forge something great.</strong>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss Welcome Message"
        onClick={() => setLeaving(true)}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
