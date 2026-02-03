import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import App from './App';
import './index.css';
import { createApolloClient } from './lib/apollo';
import { InvoiceDraftProvider } from './state/invoiceDraft';

const root = document.getElementById('root');

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
