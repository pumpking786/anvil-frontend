import '@fontsource/dm-sans/400-italic.css';
import '@fontsource/dm-sans/600-italic.css';
import '@fontsource/dm-sans/700-italic.css';
import '@fontsource/open-sans/400-italic.css';
import '@fontsource/open-sans/600-italic.css';
import '@fontsource/open-sans/700-italic.css';
import '@fontsource/newsreader/600-italic.css';
import '@fontsource/newsreader/700-italic.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-devanagari/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/700.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/noto-sans-devanagari/400.css';
import App from './App';
import { initializeColorScheme } from './lib/colorScheme';
import { setFaviconSource } from './lib/installationBrand';
import { savedServer } from './lib/session';
import './styles.css';
import './styles/theme.css';
import './styles/light.css';
import './styles/login.css';
import './styles/identity.css';
import './styles/portal.css';
import './styles/motion.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="startup">
        <h1>Something interrupted your workspace.</h1>
        <p>Your last saved records are safe. Reload to sign in again.</p>
        <button onClick={() => location.reload()}>Reload Workspace</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
initializeColorScheme();
// Hydrate public branding and start image requests before the first React render.
setFaviconSource(import.meta.env.VITE_API_URL || savedServer()?.url || location.origin + '/api');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
