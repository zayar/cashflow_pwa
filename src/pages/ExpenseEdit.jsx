import { gql, useQuery } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ExpenseForm from './ExpenseForm';
import { useI18n } from '../i18n';

const FIND_EXPENSE = gql`
  query FindExpenseForEdit($limit: Int = 120) {
    paginateExpense(limit: $limit) {
      edges {
        node {
          id
          expenseDate
          branch {
            id
            name
          }
          expenseAccount {
            id
            name
          }
          assetAccount {
            id
            name
            currency {
              id
              symbol
              decimalPlaces
              name
            }
          }
          currency {
            id
            name
            symbol
            decimalPlaces
          }
          exchangeRate
          amount
          bankCharges
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
          expenseTax {
            id
            name
            rate
            type
          }
          isTaxInclusive
          documents {
            id
            documentUrl
          }
        }
      }
    }
  }
`;

function ExpenseEdit() {
  const { t } = useI18n();
  const { id } = useParams();
  const [limit, setLimit] = useState(120);

  const { data, loading, error, refetch } = useQuery(FIND_EXPENSE, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
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
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p className="state-title">{t('expenseView.notFoundTitle')}</p>
          <p className="state-message">{t('expenseEdit.returnAndRefresh')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.tryAgain')}
          </button>
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
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  return <ExpenseForm mode="edit" expense={expense} />;
}

export default ExpenseEdit;

