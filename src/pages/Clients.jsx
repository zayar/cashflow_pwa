import { useQuery, gql } from '@apollo/client';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

const GET_CUSTOMERS = gql`
  query GetCustomers($limit: Int, $after: String) {
    paginateCustomer(limit: $limit, after: $after) {
      edges {
        node {
          id
          name
          email
          phone
          totalOutstandingReceivable
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

function ClientsLoading() {
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

function Clients() {
  const location = useLocation();
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data, loading, error, refetch } = useQuery(GET_CUSTOMERS, {
    variables: { limit: 50 },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first'
  });

  useEffect(() => {
    if (location.state?.created) {
      setSuccessMsg('Client created successfully!');
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [location.state]);

  const customers = useMemo(
    () => data?.paginateCustomer?.edges?.map((edge) => edge.node) ?? [],
    [data]
  );

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const outstanding = Number(customer.totalOutstandingReceivable || 0);
      if (filter === 'outstanding' && outstanding <= 0) return false;
      if (!term) return true;
      const haystack = `${customer.name || ''} ${customer.email || ''} ${customer.phone || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [customers, filter, search]);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Customers</p>
            <h2 className="title">Clients ({customers.length})</h2>
          </div>
          <Link to="/clients/new" className="btn btn-primary">
            + New client
          </Link>
        </div>

        <div className="search-wrap">
          <SearchIcon />
          <input
            className="input"
            placeholder="Search name, email, or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="toolbar" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <div className="pill-tabs" role="tablist" aria-label="Client filters">
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
              className={`pill ${filter === 'outstanding' ? 'active' : ''}`}
              onClick={() => setFilter('outstanding')}
              role="tab"
              aria-selected={filter === 'outstanding'}
            >
              Outstanding
            </button>
          </div>

          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            Refresh
          </button>
        </div>

        {successMsg && <div className="toast" style={{ marginTop: 10 }}>{successMsg}</div>}
      </section>

      {loading && !data && <ClientsLoading />}

      {error && (
        <section className="state-error" role="alert">
          <p className="state-title">Could not load clients.</p>
          <p className="state-message">{error.message}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        </section>
      )}

      {!loading && !error && filteredCustomers.length === 0 && (
        <section className="state-empty" role="status">
          <p className="state-title">No clients found.</p>
          <p className="state-message">Use the + New client button to add your first customer.</p>
          <div className="state-actions">
            <Link to="/clients/new" className="btn btn-primary">
              + New client
            </Link>
          </div>
        </section>
      )}

      {!error && filteredCustomers.length > 0 && (
        <ul className="list" aria-live="polite">
          {filteredCustomers.map((client) => {
            const outstanding = Number(client.totalOutstandingReceivable || 0);
            const hasOutstanding = outstanding > 0;
            return (
              <li key={client.id} className="list-card list-clickable">
                <Link to={`/clients/${client.id}`} className="list-link">
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>{client.name}</p>
                    <p className="subtle" style={{ marginTop: 2, marginBottom: 8 }}>
                      {client.email || client.phone || 'No contact details'}
                    </p>
                    <div className="list-meta">
                      <span className="meta-chip">Client ID {client.id}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>{formatCurrency(outstanding)}</p>
                    <span className={`badge ${hasOutstanding ? 'badge-warning' : 'badge-success'}`}>
                      {hasOutstanding ? 'Outstanding' : 'Clear'}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Clients;
