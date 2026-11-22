import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global guard against internal Firestore SDK assertions (e.g. ID ca9, b815)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || '');
    if (msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED')) {
      event.preventDefault();
      console.warn('Suppressed internal Firestore assertion:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    if (message.includes('FIRESTORE') && message.includes('INTERNAL ASSERTION FAILED')) {
      event.preventDefault();
      console.warn('Suppressed internal Firestore assertion error event:', message);
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
