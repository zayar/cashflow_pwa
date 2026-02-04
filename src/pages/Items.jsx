import { useQuery, gql } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

const GET_PRODUCTS = gql`
  query GetProducts($limit: Int, $after: String) {
    paginateProduct(limit: $limit, after: $after) {
      edges {
        node {
          id
          name
          salesPrice
          sku
          isActive
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
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

function ItemsLoading() {
  return (
    <div className="state-loading" aria-live="polite">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton skeleton-line long" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function Items() {
  const location = useLocation();
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTS, {
    variables: { limit: 50 },
    fetchPolicy: 'cache-and-network'
  });

  useEffect(() => {
    if (location.state?.created) {
      setSuccessMsg('Item created successfully!');
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [location.state]);

  const products = useMemo(
    () => data?.paginateProduct?.edges?.map((edge) => edge.node) ?? [],
    [data]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((item) => {
      if (filter === 'active' && !item.isActive) return false;
      if (filter === 'inactive' && item.isActive) return false;
      if (!term) return true;
      const haystack = `${item.name || ''} ${item.sku || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [products, filter, search]);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Catalog</p>
            <h2 className="title">Items ({products.length})</h2>
          </div>
          <Link to="/items/new" className="btn btn-primary">
            + New item
          </Link>
        </div>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder="Search by item name or SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="toolbar" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <div className="pill-tabs" role="tablist" aria-label="Item filters">
            <button
              type="button"
              className={`pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              role="tab"
              aria-selected={filter === 'all'}
            >
              All
            </button>
            <button
              type="button"
              className={`pill ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
              role="tab"
              aria-selected={filter === 'active'}
            >
              Active
            </button>
            <button
              type="button"
              className={`pill ${filter === 'inactive' ? 'active' : ''}`}
              onClick={() => setFilter('inactive')}
              role="tab"
              aria-selected={filter === 'inactive'}
            >
              Inactive
            </button>
          </div>

          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            Refresh
          </button>
        </div>

        {successMsg && <div className="toast" style={{ marginTop: 10 }}>{successMsg}</div>}
      </section>

      {loading && !data && <ItemsLoading />}

      {error && (
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>Could not load items.</p>
          <p style={{ marginTop: 0, marginBottom: 12 }}>{error.message}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            Try again
          </button>
        </section>
      )}

      {!loading && !error && filteredProducts.length === 0 && (
        <section className="state-empty">
          <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>No items found.</p>
          <p style={{ margin: 0 }}>Use + New item to add products or services.</p>
        </section>
      )}

      {!error && filteredProducts.length > 0 && (
        <ul className="list" aria-live="polite">
          {filteredProducts.map((item) => (
            <li key={item.id} className="list-item list-card">
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800 }}>{item.name}</p>
                <p className="subtle" style={{ marginTop: 2, marginBottom: 8 }}>
                  {item.sku ? `SKU: ${item.sku}` : 'No SKU'}
                </p>
                <div className="list-meta">
                  <span className="meta-chip">Item ID {item.id}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 800 }}>{formatCurrency(item.salesPrice)}</p>
                <span className={`badge ${item.isActive ? 'badge-success' : 'badge-neutral'}`}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Items;
