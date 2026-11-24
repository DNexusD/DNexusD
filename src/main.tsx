import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { recoverFirestoreInstance } from './services/firebase';
import { isFirestoreInternalAssertionError } from './utils/firestoreConnectivity';

// Global guard & auto-recovery against internal Firestore SDK assertions (e.g. ID ca9, b815)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isFirestoreInternalAssertionError(event.reason)) {
      event.preventDefault();
      console.warn('Recovering from internal Firestore assertion:', event.reason);
      void recoverFirestoreInstance();
    }
  });

  window.addEventListener('error', (event) => {
    const targetErr = event.error ?? event.message;
    if (isFirestoreInternalAssertionError(targetErr)) {
      event.preventDefault();
      console.warn('Recovering from internal Firestore assertion error event:', targetErr);
      void recoverFirestoreInstance();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
