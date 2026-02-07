import { useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { formatInvoiceNumberShort, formatMoney, formatShortDate } from '../lib/formatters';

const INVOICES_QUERY = gql`
  query PaginateInvoices($limit: Int = 20) {
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          invoiceNumber
          invoiceDate
          currentStatus
          invoiceTotalAmount
          remainingBalance
          customer {
            name
          }
        }
      }
    }
  }
`;

const BUSINESS_QUERY = gql`
  query GetBusinessCurrency {
    getBusiness {
      id
      baseCurrency {
        id
        name
        symbol
      }
    }
  }
`;

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'paid', label: 'Paid' }
];

function statusClass(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('paid')) return 'badge-success';
  if (normalized.includes('draft') || normalized.includes('due')) return 'badge-warning';
  return 'badge-neutral';
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LoadingInvoices() {
  return (
    <div className="state-loading" aria-live="polite">
      <div className="skeleton-card">
        <div className="skeleton skeleton-line long" />
        <div className="skeleton skeleton-line short" />
      </div>
      <div className="skeleton-card">
        <div className="skeleton skeleton-line long" />
        <div className="skeleton skeleton-line short" />
      </div>
      <div className="skeleton-card">
        <div className="skeleton skeleton-line long" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}

function Invoices() {
  const { dispatch } = useInvoiceDraft();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: businessData } = useQuery(BUSINESS_QUERY, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const { data, loading, error, refetch } = useQuery(INVOICES_QUERY, {
    variables: { limit: 20 },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first'
  });

  const baseCurrency = businessData?.getBusiness?.baseCurrency;

  const invoices = useMemo(
    () => data?.paginateSalesInvoice?.edges?.map((edge) => edge.node) ?? [],
    [data]
  );

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const status = (invoice.currentStatus || '').toLowerCase();
      const isPaid = status.includes('paid');

      if (tab === 'paid' && !isPaid) return false;
      if (tab === 'outstanding' && isPaid) return false;

      if (!normalizedSearch) return true;
      const haystack = `${invoice.invoiceNumber || ''} ${invoice.customer?.name || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [invoices, search, tab]);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Invoice List</p>
            <h2 className="title">Recent invoices</h2>
          </div>
          <Link
            to="/invoices/new"
            className="btn btn-primary"
            onClick={() => {
              dispatch({ type: 'reset' });
            }}
          >
            + New invoice
          </Link>
        </div>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder="Search invoice # or client"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="toolbar" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <div className="pill-tabs" role="tablist" aria-label="Invoice filters">
            {tabs.map((currentTab) => (
              <button
                key={currentTab.key}
                type="button"
                className={`pill ${tab === currentTab.key ? 'active' : ''}`}
                onClick={() => setTab(currentTab.key)}
                role="tab"
                aria-selected={tab === currentTab.key}
              >
                {currentTab.label}
              </button>
            ))}
          </div>

          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </section>

      {loading && !data && <LoadingInvoices />}

      {error && (
        <section className="state-error" role="alert">
          <p className="state-title">Could not load invoices.</p>
          <p className="state-message">{error.message}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        </section>
      )}

      {!loading && !error && filtered.length === 0 && (
        <section className="state-empty" role="status">
          <p className="state-title">No invoices match this filter.</p>
          <p className="state-message">Create a new invoice to get started.</p>
          <div className="state-actions">
            <Link
              to="/invoices/new"
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'reset' });
              }}
            >
              + New invoice
            </Link>
          </div>
        </section>
      )}

      {!error && filtered.length > 0 && (
        <ul className="list" aria-live="polite">
          {filtered.map((invoice) => (
            <li key={invoice.id} className="list-card list-clickable">
              <Link to={`/invoices/${invoice.id}`} className="list-link">
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>
                    {formatInvoiceNumberShort(invoice.invoiceNumber) || `Invoice ${invoice.id}`}
                  </p>
                  <p className="subtle" style={{ marginTop: 2, marginBottom: 8 }}>
                    {invoice.customer?.name || 'No client selected'}
                  </p>
                  <div className="list-meta">
                    <span className="meta-chip">{formatShortDate(invoice.invoiceDate) || 'No date'}</span>
                    <span className="meta-chip">Balance: {formatMoney(invoice.remainingBalance, baseCurrency)}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{formatMoney(invoice.invoiceTotalAmount, baseCurrency)}</p>
                  <span className={`badge ${statusClass(invoice.currentStatus)}`}>
                    {invoice.currentStatus || 'Unknown'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Invoices;
