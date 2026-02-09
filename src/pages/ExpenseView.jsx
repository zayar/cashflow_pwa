import { gql, useQuery } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { formatMoney, formatShortDate } from '../lib/formatters';
import { resolveStorageAccessUrl } from '../lib/uploadApi';

const FIND_EXPENSE = gql`
  query FindExpenseForPwa($limit: Int = 80) {
    paginateExpense(limit: $limit) {
      edges {
        node {
          id
          expenseDate
          amount
          taxAmount
          totalAmount
          exchangeRate
          bankCharges
          isTaxInclusive
          referenceNumber
          notes
          branch {
            id
            name
          }
          currency {
            id
            name
            symbol
            decimalPlaces
          }
          expenseAccount {
            id
            name
          }
          assetAccount {
            id
            name
          }
          supplier {
            id
            name
          }
          customer {
            id
            name
          }
          expenseTax {
            id
            name
            rate
            type
          }
          documents {
            id
            documentUrl
          }
        }
      }
    }
  }
`;

function extractFilename(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutQuery = raw.split('?')[0] || raw;
  const parts = withoutQuery.split('/').filter(Boolean);
  return parts[parts.length - 1] || raw;
}

function ExpenseView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useI18n();
  const [limit, setLimit] = useState(80);

  const { data, loading, error, refetch } = useQuery(FIND_EXPENSE, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  const expense = useMemo(() => {
    const edges = data?.paginateExpense?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [data, id]);

  useEffect(() => {
    if (loading || error) return;
    if (!expense && limit < 640) {
      setLimit((prev) => Math.min(prev * 2, 640));
    }
  }, [error, expense, limit, loading]);

  if (loading && !data) {
    return (
      <div className="stack">
        <section className="state-loading" aria-live="polite">
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton skeleton-line long" />
            <div className="skeleton skeleton-line short" />
          </div>
        </section>
      </div>
    );
  }

  if (!loading && !error && !expense) {
    const canLoadMore = limit < 640;
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p className="state-title">{t('expenseView.notFoundTitle')}</p>
          <p className="state-message">{t('expenseView.notFoundMessage')}</p>
          <div className="toolbar" style={{ justifyContent: 'center', gap: 10 }}>
            {canLoadMore && (
              <button className="btn btn-secondary" type="button" onClick={() => setLimit((prev) => Math.min(prev * 2, 640))}>
                {t('common.loadMore')}
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => navigate('/expenses')}>
              {t('expenseView.backToExpenses')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p className="state-title">{t('expenseView.couldNotLoadTitle')}</p>
          <p className="state-message">{error?.message || t('expenseView.couldNotLoadMessage')}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const payee = expense?.supplier?.name || expense?.customer?.name || t('expenses.payeeFallback');
  const amount = expense?.amount ?? 0;
  const taxAmount = expense?.taxAmount ?? 0;
  const totalAmount = expense?.totalAmount ?? amount;
  const documents = expense?.documents ?? [];

  return (
    <div className="stack">
      <section className="card">
        <p className="kicker">{t('expenseView.kicker')}</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {payee}
        </h2>
        <p className="subtle" style={{ marginTop: 0 }}>
          {formatShortDate(expense.expenseDate) || t('expenses.noDate')}
          {expense?.referenceNumber ? ` · #${expense.referenceNumber}` : ''}
        </p>

        <div className="task-list" style={{ marginTop: 12 }}>
          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('expenseView.expenseAccount')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {expense?.expenseAccount?.name || t('expenses.unknownAccount')}
              </p>
            </div>
          </div>
          <div className="feature-row">
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{t('expenseView.paidThrough')}</p>
              <p className="subtle" style={{ fontSize: 13 }}>
                {expense?.assetAccount?.name || t('expenses.unknownPayment')}
              </p>
            </div>
          </div>
          {expense?.branch?.name ? (
            <div className="feature-row">
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{t('expenseView.branch')}</p>
                <p className="subtle" style={{ fontSize: 13 }}>
                  {expense.branch.name}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card">
        <p className="kicker">{t('expenseView.amountKicker')}</p>
        <div className="summary-card" style={{ marginTop: 10 }}>
          <div className="summary-row">
            <span className="summary-label">{t('expenseView.amount')}</span>
            <span className="summary-value">{formatMoney(amount, expense.currency)}</span>
          </div>
          {taxAmount ? (
            <div className="summary-row">
              <span className="summary-label">
                {t('expenseView.tax')}
                {expense?.expenseTax?.name ? ` (${expense.expenseTax.name})` : ''}
              </span>
              <span className="summary-value">{formatMoney(taxAmount, expense.currency)}</span>
            </div>
          ) : null}
          <div className="summary-row summary-total">
            <span>{t('expenseView.total')}</span>
            <span>{formatMoney(totalAmount, expense.currency)}</span>
          </div>
        </div>

        {(expense?.notes || expense?.bankCharges) && (
          <div style={{ marginTop: 12 }}>
            {expense?.notes ? (
              <div className="surface-card" style={{ marginBottom: 10 }}>
                <p className="kicker">{t('expenseView.notes')}</p>
                <p style={{ margin: 0 }}>{expense.notes}</p>
              </div>
            ) : null}
            {expense?.bankCharges ? (
              <div className="surface-card">
                <p className="kicker">{t('expenseView.bankCharges')}</p>
                <p style={{ margin: 0 }}>{formatMoney(expense.bankCharges, expense.currency)}</p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {documents.length > 0 && (
        <section className="card">
          <p className="kicker">{t('expenseView.attachments')}</p>
          <div className="picker-list" style={{ marginTop: 10 }}>
            {documents.map((doc) => {
              const href = resolveStorageAccessUrl(doc?.documentUrl);
              const label = extractFilename(doc?.documentUrl) || t('expenseView.attachment');
              return (
                <a key={doc?.id || doc?.documentUrl} className="picker-item" href={href} target="_blank" rel="noreferrer">
                  <div className="picker-item-title">{label}</div>
                  <span className="meta-chip">{t('common.open')}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <div className="sticky-actions" style={{ gridTemplateColumns: '1fr' }}>
        <button className="btn btn-primary" type="button" onClick={() => navigate(`/expenses/${expense.id}/edit`)}>
          {t('expenseView.edit')}
        </button>
      </div>
    </div>
  );
}

export default ExpenseView;

