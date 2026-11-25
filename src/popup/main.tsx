import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import '../index.css';
import { PopupApp } from './PopupApp';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <PopupApp />
  </ErrorBoundary>,
);
