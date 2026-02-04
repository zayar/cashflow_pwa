import { useMemo, useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PickerHeader from './PickerHeader';
import QuickAddItem from './QuickAddItem';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const SEARCH_PRODUCTS = gql`
  query SearchProducts($name: String) {
    paginateProduct(name: $name) {
      edges {
        node {
          id
          name
          salesPrice
          sku
        }
      }
    }
  }
`;

const RECENT_ITEMS_KEY = 'pwa-invoice-recent-items';

function loadRecentItems() {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveRecentItems(items) {
  try {
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(items.slice(0, 6)));
  } catch (err) {
    // Ignore local storage failures.
  }
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ItemPicker() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const lineId = params.get('lineId');
  const returnStep = params.get('returnStep') === 'review' ? 'review' : 'items';
  const { dispatch } = useInvoiceDraft();

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [recentItems, setRecentItems] = useState(() => loadRecentItems());

  const debounced = useDebouncedValue(search, 300);

  const { data, loading, error, refetch } = useQuery(SEARCH_PRODUCTS, {
    variables: { name: '' },
    fetchPolicy: 'cache-and-network'
  });

  useEffect(() => {
    refetch({ name: debounced || '' });
  }, [debounced, refetch]);

  const items = useMemo(
    () => data?.paginateProduct?.edges?.map((edge) => edge.node) ?? [],
    [data]
  );

  const handleSelect = (item) => {
    if (!lineId) return;

    dispatch({
      type: 'setLineItem',
      lineId,
      productId: item.id,
      name: item.name,
      rate: item.salesPrice ?? 0
    });

    const updatedRecent = [item, ...recentItems.filter((current) => current.id !== item.id)];
    setRecentItems(updatedRecent.slice(0, 6));
    saveRecentItems(updatedRecent);
    navigate(`/invoices/new?step=${returnStep}`);
  };

  return (
    <div className="picker-page">
      <PickerHeader
        title="Choose item"
        rightAction={
          <button className="btn btn-primary" type="button" onClick={() => setShowAdd(true)}>
            + Add
          </button>
        }
      />

      <section className="picker-section">
        <div className="picker-search search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder="Search items"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      {recentItems.length > 0 && (
        <section className="picker-section">
          <p className="picker-section-title">Recent items</p>
          <div className="picker-list">
            {recentItems.map((item) => (
              <button key={item.id} type="button" className="picker-item" onClick={() => handleSelect(item)}>
                <div className="picker-item-title">{item.name}</div>
                <div className="picker-item-meta">${Number(item.salesPrice ?? 0).toFixed(2)}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="picker-section">
        <p className="picker-section-title">Saved items</p>

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
            <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>Could not load items.</p>
            <p style={{ marginTop: 0, marginBottom: 0 }}>{error.message}</p>
          </div>
        )}

        {!error && (
          <div className="picker-list">
            {items.map((item) => (
              <button key={item.id} type="button" className="picker-item" onClick={() => handleSelect(item)}>
                <div className="picker-item-title">{item.name}</div>
                <div className="picker-item-meta">${Number(item.salesPrice ?? 0).toFixed(2)}</div>
              </button>
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="empty" style={{ marginTop: 10 }}>
            No items found. Add one quickly.
          </p>
        )}
      </section>

      {showAdd && (
        <QuickAddItem
          onClose={() => setShowAdd(false)}
          onSave={(item) => {
            handleSelect(item);
          }}
        />
      )}
    </div>
  );
}

export default ItemPicker;
