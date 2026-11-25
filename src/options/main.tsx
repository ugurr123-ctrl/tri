import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import '../index.css';
import { OptionsApp } from './OptionsApp';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <OptionsApp />
  </ErrorBoundary>,
);
