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
      <div className="stack reports-page">
        <section className="state-loading" aria-live="polite">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton-card" key={index}>
              <div className="skeleton skeleton-line long" />
              <div className="skeleton skeleton-line short" />
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack reports-page">
        <section className="state-error" role="alert">
          <p className="state-title">{t('reports.couldNotLoad')}</p>
          <p className="state-message">{error.message}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack reports-page">
      <section className="reports-hero">
        <p className="kicker">{t('reports.heroKicker')}</p>
        <h2 className="title">{t('reports.heroTitle')}</h2>
        <p className="subtle">{t('reports.heroSubtitle')}</p>

        <div className="reports-summary-grid">
          <div className={`reports-summary-card ${activeTab === 'paid' ? 'active' : ''}`}>
            <span className="reports-summary-label">{t('reports.tabs.paid')}</span>
            <strong className="reports-summary-value">{formatMoney(yearSummary.paidAmount, baseCurrency)}</strong>
          </div>
          <div className={`reports-summary-card ${activeTab === 'clients' ? 'active' : ''}`}>
            <span className="reports-summary-label">{t('reports.tabs.clients')}</span>
            <strong className="reports-summary-value">{yearSummary.clients}</strong>
          </div>
          <div className={`reports-summary-card ${activeTab === 'items' ? 'active' : ''}`}>
            <span className="reports-summary-label">{t('reports.tabs.items')}</span>
            <strong className="reports-summary-value">{yearSummary.items}</strong>
          </div>
        </div>
      </section>

      <section className="reports-controls" aria-label="Report filters">
        <div className="reports-tabs" role="tablist" aria-label="Report categories">
          {REPORT_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                className={`reports-tab ${isActive ? 'active' : ''}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="reports-years" role="tablist" aria-label={t('reports.selectYearAria')}>
          {yearOptions.map((yearOption) => {
            const isActive = yearOption === year;
            return (
              <button
                key={yearOption}
                type="button"
                className={`reports-year-pill ${isActive ? 'active' : ''}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => setYear(yearOption)}
              >
                {yearOption}
              </button>
            );
          })}
        </div>
      </section>

      {monthlyCards.every((month) => month.invoiceCount === 0) ? (
        <section className="state-empty" role="status">
          <p className="state-title">{t('reports.emptyTitle', { year })}</p>
          <p className="state-message">{t('reports.emptyMessage')}</p>
        </section>
      ) : (
        <section className="reports-month-list" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {monthlyCards.map((month) => (
            <article className="reports-month-card" key={`${year}-${month.monthIndex}`}>
              <div className="reports-month-head">
                <h3>{month.monthLabel}</h3>
                <span className="reports-month-chip">{t('reports.invoiceCount', { count: month.invoiceCount })}</span>
              </div>

              <div className="reports-month-grid">
                <div className="reports-metric">
                  <span>{t('reports.tabs.clients')}</span>
                  <strong>{month.clientCount}</strong>
                </div>
                <div className="reports-metric">
                  <span>{t('nav.invoices')}</span>
                  <strong>{month.invoiceCount}</strong>
                </div>
                <div className="reports-metric reports-metric-wide">
                  <span>{t('reports.tabs.paid')}</span>
                  <strong>{formatMoney(month.paidAmount, baseCurrency)}</strong>
                </div>
              </div>

              <div className={`reports-focus-line reports-focus-${activeTab}`}>
                {activeTab === 'paid' && (
                  <span>
                    {t('reports.collected')}: {formatMoney(month.paidAmount, baseCurrency)}
                  </span>
                )}
                {activeTab === 'clients' && (
                  <span>
                    {t('reports.activeClients')}: {month.clientCount}
                  </span>
                )}
                {activeTab === 'items' && (
                  <span>
                    {t('reports.uniqueItems')}: {month.itemCount} · {t('reports.qtySold')}: {month.itemQty.toLocaleString()}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default Reports;
