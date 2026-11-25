import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { OptionsApp } from './options/OptionsApp';

export default function App() {
  return (
    <ErrorBoundary>
      <OptionsApp />
    </ErrorBoundary>
  );
}
