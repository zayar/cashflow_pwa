import { useEffect, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import PickerHeader from './PickerHeader';
import QuickAddCustomer from './QuickAddCustomer';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const LIST_CUSTOMERS = gql`
  query ListCustomers($name: String) {
    listCustomer(name: $name) {
      id
      name
    }
  }
`;

function CustomerPicker() {
  const { dispatch } = useInvoiceDraft();
  const navigate = useNavigate();
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
    navigate('/invoices/new');
  };

  return (
    <div className="picker-page">
      <PickerHeader
        title="Clients"
        rightAction={
          <button className="btn btn-primary" type="button" onClick={() => setShowAdd(true)}>
            + Add client
          </button>
        }
      />

      <div className="picker-search">
        <input
          className="input"
          placeholder="Search clients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="subtle">Loading clients…</p>}
      {error && <p className="subtle" style={{ color: '#ef4444' }}>{error.message}</p>}

      <div className="picker-list">
        {customers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            className="picker-item"
            onClick={() => handleSelect(customer)}
          >
            <div className="picker-item-title">{customer.name}</div>
          </button>
        ))}
        {!loading && customers.length === 0 && (
          <p className="empty">No clients found.</p>
        )}
      </div>

      {showAdd && (
        <QuickAddCustomer
          onClose={() => setShowAdd(false)}
          onSave={(customer) => {
            dispatch({
              type: 'setCustomer',
              customerId: customer.id,
              customerName: customer.name
            });
          }}
        />
      )}
    </div>
  );
}

export default CustomerPicker;
