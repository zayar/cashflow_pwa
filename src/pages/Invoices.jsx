import { useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';

const INVOICES_QUERY = gql`
  query PaginateInvoices($limit: Int = 20) {
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          invoiceNumber
          invoiceDate
          currentStatus
          invoiceTotalAmount
          remainingBalance
          customer {
            name
          }
        }
      }
    }
  }
`;

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'paid', label: 'Paid' }
];

function Invoices() {
  const [tab, setTab] = useState('all');
  const { data, loading, error, refetch } = useQuery(INVOICES_QUERY, {
    variables: { limit: 20 }
  });

  const invoices = useMemo(
    () => data?.paginateSalesInvoice?.edges?.map((e) => e.node) ?? [],
    [data]
  );

  const filtered = useMemo(() => {
    if (tab === 'all') return invoices;
    if (tab === 'paid') {
      return invoices.filter((inv) =>
        (inv.currentStatus || '').toLowerCase().includes('paid')
      );
    }
    // outstanding
    return invoices.filter(
      (inv) => !(inv.currentStatus || '').toLowerCase().includes('paid')
    );
  }, [tab, invoices]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <div>
          <p className="subtle">Invoice list</p>
          <h2 className="heading">Recent invoices</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/invoices/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + New invoice
          </Link>
          <div className="pill-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`pill ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="subtle">Loading invoices…</p>}
      {error && <p className="subtle" style={{ color: '#ef4444' }}>{error.message}</p>}

      <ul className="list">
        {filtered.map((inv) => (
          <li key={inv.id} className="list-item">
            <div>
              <div style={{ fontWeight: 700 }}>{inv.invoiceNumber || inv.id}</div>
              <div className="subtle">{inv.customer?.name || '—'}</div>
              <div className="subtle">
                {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800 }}>
                ${Number(inv.invoiceTotalAmount ?? inv.remainingBalance ?? 0).toFixed(2)}
              </div>
              <span className="badge" style={{ textTransform: 'capitalize' }}>
                {inv.currentStatus || '—'}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && !loading && !error && (
        <p className="empty">No invoices yet.</p>
      )}

      <div className="toolbar" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
          Refresh
        </button>
      </div>
    </div>
  );
}

export default Invoices;
