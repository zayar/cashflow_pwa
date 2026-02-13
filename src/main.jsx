import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import App from './App';
import './index.css';
import { createApolloClient } from './lib/apollo';
import { buildInvoiceShareUrl } from './lib/shareApi';
import { InvoiceDraftProvider } from './state/invoiceDraft';
import { BusinessProfileProvider } from './state/businessProfile';
import { I18nProvider } from './i18n';

const root = document.getElementById('root');

// Back-compat: old share links used `/#/public/invoices/:token` on this app.
// Redirect to the canonical public invoice viewer (no auth) used by the Cashflow web app.
if (typeof window !== 'undefined') {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/public\/invoices\/(.+)$/);
  if (match && match[1]) {
    const [tokenPart, queryPart] = String(match[1]).split('?');
    const qs = new URLSearchParams(queryPart || '');
    const lang = qs.get('lang') || '';
    const target = buildInvoiceShareUrl(tokenPart, { lang });
    if (target && target !== window.location.href) {
      window.location.replace(target);
    }
  }
}

const client = createApolloClient();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <BusinessProfileProvider>
        <InvoiceDraftProvider>
          <I18nProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </I18nProvider>
        </InvoiceDraftProvider>
      </BusinessProfileProvider>
    </ApolloProvider>
  </React.StrictMode>
);
