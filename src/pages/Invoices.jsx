import { useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { formatInvoiceNumberShort, formatMoney, formatShortDate } from '../lib/formatters';
import { extractStorageObjectKey } from '../lib/uploadApi';
import { useI18n } from '../i18n';
import { getInvoiceStatusKey } from '../i18n/status';

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
          documents {
            documentUrl
          }
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
  { key: 'all', labelKey: 'invoices.tabs.all' },
  { key: 'outstanding', labelKey: 'invoices.tabs.outstanding' },
  { key: 'paid', labelKey: 'invoices.tabs.paid' }
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
  const { t } = useI18n();
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

  const paymentProofCount = (invoice) => {
    const docs = invoice?.documents || [];
    if (!Array.isArray(docs) || docs.length === 0) return 0;
    const segment = `/sales_invoices/${String(invoice?.id || '')}/payment_proofs/`;
    return docs.filter((d) => {
      const raw = d?.documentUrl || '';
      const key = extractStorageObjectKey(raw) || String(raw);
      return !!key && key.includes(segment);
    }).length;
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">{t('invoices.cardKicker')}</p>
            <h2 className="title">INVOICES</h2>
          </div>
          <Link
            to="/invoices/new"
            className="btn btn-primary"
            onClick={() => {
              dispatch({ type: 'reset' });
            }}
          >
            {t('invoices.newInvoice')}
          </Link>
        </div>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder={t('invoices.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="toolbar" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <div className="pill-tabs" role="tablist" aria-label={t('invoices.filterAria')}>
            {tabs.map((currentTab) => (
              <button
                key={currentTab.key}
                type="button"
                className={`pill ${tab === currentTab.key ? 'active' : ''}`}
                onClick={() => setTab(currentTab.key)}
                role="tab"
                aria-selected={tab === currentTab.key}
              >
                {t(currentTab.labelKey)}
              </button>
            ))}
          </div>

          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.refresh')}
          </button>
        </div>
      </section>

      {loading && !data && <LoadingInvoices />}

      {error && (
        <section className="state-error" role="alert">
          <p className="state-title">{t('invoices.couldNotLoad')}</p>
          <p className="state-message">{error.message}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      )}

      {!loading && !error && filtered.length === 0 && (
        <section className="state-empty" role="status">
          <p className="state-title">{t('invoices.emptyTitle')}</p>
          <p className="state-message">{t('invoices.emptyMessage')}</p>
          <div className="state-actions">
            <Link
              to="/invoices/new"
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'reset' });
              }}
            >
              {t('invoices.newInvoice')}
            </Link>
          </div>
        </section>
      )}

      {!error && filtered.length > 0 && (
        <ul className="list" aria-live="polite">
          {filtered.map((invoice) => (
            <li key={invoice.id} className="list-card list-clickable">
              <Link to={`/invoices/${invoice.id}`} className="list-link">
                {(() => {
                  const proofCount = paymentProofCount(invoice);
                  return (
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>
                    {formatInvoiceNumberShort(invoice.invoiceNumber) || `${t('pages.invoiceView.title')} ${invoice.id}`}
                  </p>
                  <p className="subtle" style={{ marginTop: 2, marginBottom: 8 }}>
                    {invoice.customer?.name || t('invoices.noClientSelected')}
                  </p>
                  <div className="list-meta">
                    <span className="meta-chip">{formatShortDate(invoice.invoiceDate) || t('invoices.noDate')}</span>
                    <span className="meta-chip">
                      {t('invoices.balance')}: {formatMoney(invoice.remainingBalance, baseCurrency)}
                    </span>
                    {proofCount > 0 && <span className="meta-chip">Proof: {proofCount}</span>}
                  </div>
                </div>
                  );
                })()}

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{formatMoney(invoice.invoiceTotalAmount, baseCurrency)}</p>
                  <span className={`badge ${statusClass(invoice.currentStatus)}`}>
                    {(() => {
                      const rawStatus = invoice.currentStatus || '';
                      const statusKey = getInvoiceStatusKey(rawStatus);
                      return statusKey ? t(statusKey) : rawStatus || t('invoices.unknown');
                    })()}
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
