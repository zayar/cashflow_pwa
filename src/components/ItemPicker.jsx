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
    // ignore
  }
}

function ItemPicker() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const lineId = params.get('lineId');
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
    const updatedRecent = [item, ...recentItems.filter((i) => i.id !== item.id)];
    setRecentItems(updatedRecent.slice(0, 6));
    saveRecentItems(updatedRecent);
    navigate('/invoices/new');
  };

  return (
    <div className="picker-page">
      <PickerHeader
        title="Item"
        rightAction={
          <button className="btn btn-primary" type="button" onClick={() => setShowAdd(true)}>
            + Add item
          </button>
        }
      />

      <div className="picker-search">
        <input
          className="input"
          placeholder="Search items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {recentItems.length > 0 && (
        <div className="picker-section">
          <div className="picker-section-title">Recent items</div>
          {recentItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="picker-item"
              onClick={() => handleSelect(item)}
            >
              <div className="picker-item-title">{item.name}</div>
              <div className="picker-item-meta">${Number(item.salesPrice ?? 0).toFixed(2)}</div>
            </button>
          ))}
        </div>
      )}

      <div className="picker-section">
        <div className="picker-section-title">Saved items</div>
        {loading && <p className="subtle">Loading items…</p>}
        {error && <p className="subtle" style={{ color: '#ef4444' }}>{error.message}</p>}

        <div className="picker-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="picker-item"
              onClick={() => handleSelect(item)}
            >
              <div className="picker-item-title">{item.name}</div>
              <div className="picker-item-meta">${Number(item.salesPrice ?? 0).toFixed(2)}</div>
            </button>
          ))}
        </div>

        {!loading && items.length === 0 && (
          <p className="empty">No items found.</p>
        )}
      </div>

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
