import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import App from './App';
import './index.css';
import { createApolloClient } from './lib/apollo';
import { buildInvoiceShareUrl } from './lib/shareApi';
import { InvoiceDraftProvider } from './state/invoiceDraft';

const root = document.getElementById('root');

// Back-compat: old share links used `/#/public/invoices/:token` on this app.
// Redirect to the canonical public invoice viewer (no auth) used by the Cashflow web app.
if (typeof window !== 'undefined') {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/public\/invoices\/(.+)$/);
  if (match && match[1]) {
    const target = buildInvoiceShareUrl(match[1]);
    if (target && target !== window.location.href) {
      window.location.replace(target);
    }
  }
}

const client = createApolloClient();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <InvoiceDraftProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </InvoiceDraftProvider>
    </ApolloProvider>
  </React.StrictMode>
);
