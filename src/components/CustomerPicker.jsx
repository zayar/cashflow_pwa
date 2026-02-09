import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PickerHeader from './PickerHeader';
import QuickAddCustomer from './QuickAddCustomer';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useI18n } from '../i18n';

const LIST_CUSTOMERS = gql`
  query ListCustomers($name: String) {
    listCustomer(name: $name) {
      id
      name
    }
  }
`;

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CustomerPicker() {
  const { t } = useI18n();
  const { dispatch } = useInvoiceDraft();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo') || '/invoices/new';
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const debounced = useDebouncedValue(search, 300);

  const { data, loading, error, refetch } = useQuery(LIST_CUSTOMERS, {
    variables: { name: '' },
    fetchPolicy: 'cache-and-network'
  });

  useEffect(() => {
    refetch({ name: debounced || '' });
  }, [debounced, refetch]);

  const customers = data?.listCustomer ?? [];

  const handleSelect = (customer) => {
    dispatch({
      type: 'setCustomer',
      customerId: customer.id,
      customerName: customer.name
    });
    navigate(returnTo);
  };

  return (
    <div className="picker-page">
      <PickerHeader
        title={t('picker.chooseClient')}
        backTo={returnTo}
        rightAction={
          <button className="btn btn-primary" type="button" onClick={() => setShowAdd(true)}>
            {t('picker.add')}
          </button>
        }
      />

      <section className="picker-section">
        <div className="picker-search search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder={t('picker.searchClients')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading && !data && (
          <div className="state-loading" style={{ marginTop: 8 }}>
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
          <div className="state-error" role="alert">
            <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>{t('clients.couldNotLoad')}</p>
            <p style={{ marginTop: 0, marginBottom: 0 }}>{error.message}</p>
          </div>
        )}

        {!error && (
          <div className="picker-list" style={{ marginTop: 10 }}>
            {customers.map((customer) => (
              <button key={customer.id} type="button" className="picker-item" onClick={() => handleSelect(customer)}>
                <div className="picker-item-title">{customer.name}</div>
                <span className="meta-chip">{t('picker.select')}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && !error && customers.length === 0 && (
          <p className="empty" style={{ marginTop: 10 }}>
            {t('picker.noClientsFound')}
          </p>
        )}
      </section>

      {showAdd && (
        <QuickAddCustomer
          onClose={() => setShowAdd(false)}
          onSave={(customer) => {
            handleSelect(customer);
          }}
        />
      )}
    </div>
  );
}

export default CustomerPicker;
