import { gql, useQuery } from '@apollo/client';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { formatMoney, formatShortDate } from '../lib/formatters';

const PAGINATE_EXPENSES = gql`
  query PaginateExpenseForPwa($limit: Int = 30, $after: String, $fromDate: MyDateString, $toDate: MyDateString) {
    paginateExpense(limit: $limit, after: $after, fromDate: $fromDate, toDate: $toDate) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          expenseDate
          amount
          taxAmount
          totalAmount
          expenseAccount {
            id
            name
          }
          assetAccount {
            id
            name
          }
          currency {
            id
            name
            symbol
            decimalPlaces
          }
          supplier {
            id
            name
          }
          customer {
            id
            name
          }
          referenceNumber
          notes
        }
      }
    }
  }
`;

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function monthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { fromDate: toIsoDate(start), toDate: toIsoDate(now) };
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const filters = [
  { key: 'month', labelKey: 'expenses.filters.thisMonth' },
  { key: 'all', labelKey: 'expenses.filters.all' }
];

function Expenses() {
  const { t } = useI18n();
  const [filter, setFilter] = useState('month');
  const [search, setSearch] = useState('');

  const range = useMemo(() => (filter === 'month' ? monthRange() : { fromDate: undefined, toDate: undefined }), [filter]);

  const { data, loading, error, refetch, fetchMore } = useQuery(PAGINATE_EXPENSES, {
    variables: { limit: 30, after: undefined, fromDate: range.fromDate, toDate: range.toDate },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const pageInfo = data?.paginateExpense?.pageInfo;
  const rows = useMemo(() => data?.paginateExpense?.edges?.map((edge) => edge?.node).filter(Boolean) ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const parts = [
        row?.supplier?.name,
        row?.customer?.name,
        row?.expenseAccount?.name,
        row?.assetAccount?.name,
        row?.referenceNumber,
        row?.notes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return parts.includes(q);
    });
  }, [rows, search]);

  const handleLoadMore = async () => {
    if (!pageInfo?.hasNextPage) return;
    await fetchMore({
      variables: {
        after: pageInfo.endCursor
      }
    });
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">{t('expenses.cardKicker')}</p>
            <h2 className="title">{t('expenses.cardTitle')}</h2>
          </div>
          <Link to="/expenses/new" className="btn btn-primary">
            {t('expenses.newExpense')}
          </Link>
        </div>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder={t('expenses.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="toolbar" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <div className="pill-tabs" role="tablist" aria-label={t('expenses.filterAria')}>
            {filters.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`pill ${filter === option.key ? 'active' : ''}`}
                onClick={() => setFilter(option.key)}
                role="tab"
                aria-selected={filter === option.key}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.refresh')}
          </button>
        </div>
      </section>

      {loading && !data && (
        <div className="state-loading" aria-live="polite">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
        </div>
      )}

      {error && (
        <section className="state-error" role="alert">
          <p className="state-title">{t('expenses.couldNotLoad')}</p>
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
          <p className="state-title">{t('expenses.emptyTitle')}</p>
          <p className="state-message">{t('expenses.emptyMessage')}</p>
          <div className="state-actions">
            <Link to="/expenses/new" className="btn btn-primary">
              {t('expenses.newExpense')}
            </Link>
          </div>
        </section>
      )}

      {!error && filtered.length > 0 && (
        <>
          <ul className="list" aria-live="polite">
            {filtered.map((expense) => {
              const payee = expense?.supplier?.name || expense?.customer?.name || t('expenses.payeeFallback');
              const amount = expense?.totalAmount ?? expense?.amount ?? 0;
              return (
                <li key={expense.id} className="list-card list-clickable">
                  <Link to={`/expenses/${expense.id}`} className="list-link">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800 }}>{payee}</p>
                      <p className="subtle" style={{ marginTop: 2, marginBottom: 8 }}>
                        {(expense?.expenseAccount?.name || t('expenses.unknownAccount')) + ' · ' + (expense?.assetAccount?.name || t('expenses.unknownPayment'))}
                      </p>
                      <div className="list-meta">
                        <span className="meta-chip">{formatShortDate(expense.expenseDate) || t('expenses.noDate')}</span>
                        {expense?.referenceNumber ? <span className="meta-chip">#{expense.referenceNumber}</span> : null}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800 }}>{formatMoney(amount, expense.currency)}</p>
                      <p className="subtle" style={{ margin: '4px 0 0' }}>
                        {t('expenses.total')}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {pageInfo?.hasNextPage && (
            <div className="state-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" type="button" onClick={handleLoadMore}>
                {t('common.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Expenses;

