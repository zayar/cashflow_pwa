import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { formatMoney } from '../lib/formatters';
import { useI18n } from '../i18n';

const REPORTS_QUERY = gql`
  query ReportsInvoices($limit: Int = 400) {
    getBusiness {
      id
      baseCurrency {
        id
        name
        symbol
      }
    }
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          invoiceDate
          invoiceTotalAmount
          remainingBalance
          customer {
            id
            name
          }
          details {
            id
            name
            detailQty
          }
        }
      }
    }
  }
`;

const REPORT_TABS = [
  { key: 'paid', labelKey: 'reports.tabs.paid' },
  { key: 'clients', labelKey: 'reports.tabs.clients' },
  { key: 'items', labelKey: 'reports.tabs.items' }
];

function parseInvoiceDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'short' });
}

// Trend indicator component (placeholder for future trend data)
function TrendIndicator({ direction = 'up' }) {
  return (
    <span className={`trend-indicator ${direction}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'up' ? (
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        ) : (
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        )}
      </svg>
    </span>
  );
}

function Reports() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('paid');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const swipeStartX = useRef(null);
  const now = useMemo(() => new Date(), []);

  const { data, loading, error, refetch } = useQuery(REPORTS_QUERY, {
    variables: { limit: 400 },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  const invoices = useMemo(() => {
    return data?.paginateSalesInvoice?.edges?.map((edge) => edge?.node).filter(Boolean) || [];
  }, [data]);

  const baseCurrency = data?.getBusiness?.baseCurrency;

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    const yearSet = new Set([current, current - 1, current - 2]);

    invoices.forEach((invoice) => {
      const date = parseInvoiceDate(invoice?.invoiceDate);
      if (!date) return;
      if (date <= now) {
        yearSet.add(date.getFullYear());
      }
    });

    return Array.from(yearSet)
      .filter((item) => item <= current)
      .sort((a, b) => b - a);
  }, [invoices, now]);

  useEffect(() => {
    if (yearOptions.length === 0) return;
    if (!yearOptions.includes(year)) {
      setYear(yearOptions[0]);
    }
  }, [year, yearOptions]);

  const selectedYearInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const date = parseInvoiceDate(invoice?.invoiceDate);
      return date && date <= now && date.getFullYear() === year;
    });
  }, [invoices, now, year]);

  const monthlyCards = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      monthIndex,
      invoiceCount: 0,
      paidAmount: 0,
      clients: new Set(),
      items: new Set(),
      itemQty: 0
    }));

    selectedYearInvoices.forEach((invoice) => {
      const date = parseInvoiceDate(invoice?.invoiceDate);
      if (!date) return;
      const month = buckets[date.getMonth()];
      month.invoiceCount += 1;

      const invoiceTotal = Number(invoice?.invoiceTotalAmount || 0);
      const remaining = Number(invoice?.remainingBalance || 0);
      const paid = Math.max(0, invoiceTotal - Math.max(0, remaining));
      month.paidAmount += paid;

      const customerId = invoice?.customer?.id;
      const customerName = String(invoice?.customer?.name || '').trim().toLowerCase();
      if (customerId) month.clients.add(`id:${customerId}`);
      else if (customerName) month.clients.add(`name:${customerName}`);

      (invoice?.details || []).forEach((detail) => {
        const itemName = String(detail?.name || '').trim().toLowerCase();
        if (itemName) month.items.add(itemName);
        month.itemQty += Number(detail?.detailQty || 0);
      });
    });

    return buckets
      .map((month) => ({
        monthIndex: month.monthIndex,
        monthLabel: monthLabel(year, month.monthIndex),
        invoiceCount: month.invoiceCount,
        clientCount: month.clients.size,
        paidAmount: month.paidAmount,
        itemCount: month.items.size,
        itemQty: month.itemQty
      }))
      .filter((month) => month.invoiceCount > 0)
      .reverse();
  }, [selectedYearInvoices, year]);

  const yearSummary = useMemo(() => {
    const clientSet = new Set();
    const itemSet = new Set();
    let invoiceCount = 0;
    let paidAmount = 0;
    let itemQty = 0;

    selectedYearInvoices.forEach((invoice) => {
      invoiceCount += 1;
      const invoiceTotal = Number(invoice?.invoiceTotalAmount || 0);
      const remaining = Number(invoice?.remainingBalance || 0);
      paidAmount += Math.max(0, invoiceTotal - Math.max(0, remaining));

      const customerId = invoice?.customer?.id;
      const customerName = String(invoice?.customer?.name || '').trim().toLowerCase();
      if (customerId) clientSet.add(`id:${customerId}`);
      else if (customerName) clientSet.add(`name:${customerName}`);

      (invoice?.details || []).forEach((detail) => {
        const itemName = String(detail?.name || '').trim().toLowerCase();
        if (itemName) itemSet.add(itemName);
        itemQty += Number(detail?.detailQty || 0);
      });
    });

    return {
      invoices: invoiceCount,
      clients: clientSet.size,
      paidAmount,
      items: itemSet.size,
      itemQty
    };
  }, [selectedYearInvoices]);

  const changeTabBySwipe = (direction) => {
    const currentIndex = REPORT_TABS.findIndex((tab) => tab.key === activeTab);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= REPORT_TABS.length) return;
    setActiveTab(REPORT_TABS[nextIndex].key);
  };

  const onTouchStart = (event) => {
    swipeStartX.current = event.changedTouches?.[0]?.clientX ?? null;
  };

  const onTouchEnd = (event) => {
    const startX = swipeStartX.current;
    const endX = event.changedTouches?.[0]?.clientX ?? null;
    swipeStartX.current = null;
    if (startX == null || endX == null) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 44) return;
    if (delta < 0) changeTabBySwipe(1);
    if (delta > 0) changeTabBySwipe(-1);
  };

  if (loading && !data) {
    return (
      <div className="reports-v2">
        <div className="reports-v2-loading">
          <div className="reports-v2-spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-v2">
        <div className="reports-v2-error" role="alert">
          <div className="reports-v2-error-icon">!</div>
          <h3>{t('reports.couldNotLoad')}</h3>
          <p>{error.message}</p>
          <button className="btn btn-primary" type="button" onClick={() => refetch()}>
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-v2">
      {/* Hero Section - Total Revenue */}
      <section className="reports-v2-hero">
        <div className="reports-v2-hero-content">
          <span className="reports-v2-hero-label">{t('reports.totalRevenue')}</span>
          <div className="reports-v2-hero-amount">
            <span className="currency">{baseCurrency?.symbol || 'MMK'}</span>
            <span className="amount">{formatMoney(yearSummary.paidAmount, baseCurrency).replace(baseCurrency?.symbol || 'MMK', '').trim()}</span>
          </div>
          <div className="reports-v2-hero-meta">
            <span>{year} · {yearSummary.invoices} {t('reports.invoices')}</span>
          </div>
        </div>
        <div className="reports-v2-hero-trend">
          <TrendIndicator direction="up" />
        </div>
      </section>

      {/* Controls - Year & Tab Selection */}
      <section className="reports-v2-controls">
        {/* Year Selector */}
        <div className="reports-v2-year-selector">
          {yearOptions.map((yearOption) => (
            <button
              key={yearOption}
              type="button"
              className={`reports-v2-year-btn ${yearOption === year ? 'active' : ''}`}
              onClick={() => setYear(yearOption)}
            >
              {yearOption}
            </button>
          ))}
        </div>

        {/* Tab Selector */}
        <div className="reports-v2-tabs">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`reports-v2-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* Monthly Cards */}
      {monthlyCards.length === 0 ? (
        <section className="reports-v2-empty">
          <div className="reports-v2-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3>{t('reports.emptyTitle', { year })}</h3>
          <p>{t('reports.emptyMessage')}</p>
        </section>
      ) : (
        <section className="reports-v2-months" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {monthlyCards.map((month, index) => {
            const prevMonth = monthlyCards[index + 1];
            const revenueTrend = prevMonth 
              ? month.paidAmount >= prevMonth.paidAmount ? 'up' : 'down'
              : 'up';
            
            return (
              <article className="reports-v2-card" key={`${year}-${month.monthIndex}`}>
                {/* Card Header */}
                <div className="reports-v2-card-header">
                  <div className="reports-v2-card-month">
                    <h3>{month.monthLabel}</h3>
                    <span className="reports-v2-card-year">{year}</span>
                  </div>
                  <div className="reports-v2-card-badge">
                    {month.invoiceCount} {t('reports.invoices')}
                  </div>
                </div>

                {/* Revenue - Hero Element */}
                <div className="reports-v2-card-revenue">
                  <span className="revenue-label">{t('reports.revenue')}</span>
                  <div className="revenue-amount">
                    <span className="revenue-currency">{baseCurrency?.symbol || 'MMK'}</span>
                    <span className="revenue-value">
                      {formatMoney(month.paidAmount, baseCurrency).replace(baseCurrency?.symbol || 'MMK', '').trim()}
                    </span>
                    <TrendIndicator direction={revenueTrend} />
                  </div>
                </div>

                {/* Divider */}
                <div className="reports-v2-card-divider" />

                {/* Metrics Row */}
                <div className="reports-v2-card-metrics">
                  <div className="metric-item">
                    <span className="metric-value">{month.clientCount}</span>
                    <span className="metric-label">{t('reports.clients')}</span>
                  </div>
                  <div className="metric-divider" />
                  <div className="metric-item">
                    <span className="metric-value">{month.invoiceCount}</span>
                    <span className="metric-label">{t('reports.invoices')}</span>
                  </div>
                  <div className="metric-divider" />
                  <div className="metric-item">
                    <span className="metric-value">{month.itemCount}</span>
                    <span className="metric-label">{t('reports.items')}</span>
                  </div>
                </div>

                {/* Active Tab Detail */}
                <div className={`reports-v2-card-detail reports-v2-card-detail--${activeTab}`}>
                  {activeTab === 'paid' && (
                    <>
                      <span className="detail-label">{t('reports.collected')}</span>
                      <span className="detail-value">{formatMoney(month.paidAmount, baseCurrency)}</span>
                    </>
                  )}
                  {activeTab === 'clients' && (
                    <>
                      <span className="detail-label">{t('reports.activeClients')}</span>
                      <span className="detail-value">{month.clientCount} {t('reports.clients')}</span>
                    </>
                  )}
                  {activeTab === 'items' && (
                    <>
                      <span className="detail-label">{t('reports.itemsSold')}</span>
                      <span className="detail-value">{month.itemQty.toLocaleString()} {t('reports.qty')}</span>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default Reports;
