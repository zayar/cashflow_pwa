import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import App from './App';
import './index.css';
import { createApolloClient } from './lib/apollo';
import { InvoiceDraftProvider } from './state/invoiceDraft';
import { BusinessProfileProvider } from './state/businessProfile';
import { OnboardingStatusProvider } from './state/onboardingStatus';
import { I18nProvider } from './i18n';

const root = document.getElementById('root');

// Back-compat: old share links used hash-based `/#/public/invoices/:token`.
// Rewrite to the real BrowserRouter path `/p/:token` so the public viewer renders.
if (typeof window !== 'undefined') {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/public\/invoices\/(.+)$/);
  if (match && match[1]) {
    const [tokenPart, queryPart] = String(match[1]).split('?');
    const qs = new URLSearchParams(queryPart || '');
    const lang = qs.get('lang') || '';
    const langSuffix = lang && lang !== 'en' ? `?lang=${encodeURIComponent(lang)}` : '';
    window.location.replace(`/p/${encodeURIComponent(tokenPart)}${langSuffix}`);
  }
}

const client = createApolloClient();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <OnboardingStatusProvider>
        <BusinessProfileProvider>
          <InvoiceDraftProvider>
            <I18nProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </I18nProvider>
          </InvoiceDraftProvider>
        </BusinessProfileProvider>
      </OnboardingStatusProvider>
    </ApolloProvider>
  </React.StrictMode>
);
