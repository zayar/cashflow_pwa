import { useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { useInvoiceDraft } from '../state/invoiceDraft';

const FIND_CUSTOMER = gql`
  query FindCustomer($limit: Int = 80) {
    paginateCustomer(limit: $limit) {
      edges {
        node {
          id
          name
          email
          phone
          billingAddress
          shippingAddress
          totalOutstandingReceivable
        }
      }
    }
  }
`;

const FIND_INVOICES = gql`
  query FindInvoicesForClient($limit: Int = 200) {
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          customer {
            id
          }
        }
      }
    }
  }
`;

const DELETE_CUSTOMER = gql`
  mutation DeleteCustomer($id: ID!) {
    deleteCustomer(id: $id) {
      id
      name
    }
  }
`;

function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function ClientView() {
  const navigate = useNavigate();
  const { dispatch } = useInvoiceDraft();
  const { id } = useParams();

  const [limit, setLimit] = useState(80);
  const [status, setStatus] = useState('');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery(FIND_CUSTOMER, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const { data: invoiceData } = useQuery(FIND_INVOICES, {
    variables: { limit: 200 },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const [deleteCustomer, deleteState] = useMutation(DELETE_CUSTOMER);

  const customer = useMemo(() => {
    const edges = data?.paginateCustomer?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [data, id]);

  const invoices = useMemo(() => invoiceData?.paginateSalesInvoice?.edges ?? [], [invoiceData]);
  const hasRecentTransactions = useMemo(() => {
    if (!id) return false;
    return invoices.some((edge) => String(edge?.node?.customer?.id || '') === String(id));
  }, [id, invoices]);

  const outstanding = Number(customer?.totalOutstandingReceivable || 0);
  const hasOutstanding = outstanding > 0;
  const canDelete = !hasOutstanding && !hasRecentTransactions;

  const handleCreateInvoice = () => {
    if (!customer) return;
    dispatch({ type: 'reset' });
    dispatch({ type: 'setCustomer', customerId: customer.id, customerName: customer.name });
    setIsActionsOpen(false);
    navigate('/invoices/new?step=items');
  };

  const handleEdit = () => {
    if (!customer) return;
    setIsActionsOpen(false);
    navigate(`/clients/${customer.id}/edit`);
  };

  const handleDelete = async () => {
    if (!customer || !canDelete) return;
    setStatus('');
    try {
      await deleteCustomer({ variables: { id: customer.id } });
      navigate('/clients', { replace: true, state: { deleted: true } });
    } catch (err) {
      setStatus(err.message || 'Failed to delete client.');
    }
  };

  const saving = deleteState.loading;

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

  if (!loading && !error && !customer) {
    const canLoadMore = limit < 640;
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Client not found in recent clients.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            Tap load more to search further back, or return to clients.
          </p>
          <div className="toolbar" style={{ justifyContent: 'center', gap: 10 }}>
            {canLoadMore && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setLimit((prev) => Math.min(prev * 2, 640))}
              >
                Load more
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => navigate('/clients')}>
              Back to clients
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load this client.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{error?.message || 'Client not found.'}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="kicker">Customer</p>
            <h2 className="title">{customer.name || 'Client'}</h2>
          </div>
          <span className={`badge ${hasOutstanding ? 'badge-warning' : 'badge-success'}`}>
            {hasOutstanding ? 'Outstanding' : 'Clear'}
          </span>
        </div>
        <div className="list-meta">
          {customer.email && <span className="meta-chip">Email: {customer.email}</span>}
          {customer.phone && <span className="meta-chip">Phone: {customer.phone}</span>}
          <span className="meta-chip">Client ID {customer.id}</span>
          <span className="meta-chip">Outstanding: {formatCurrency(outstanding)}</span>
        </div>
      </section>

      <section className="surface-card">
        <div className="form-grid">
          <div className="field">
            <span className="label">Billing address</span>
            <p className="subtle" style={{ margin: 0 }}>
              {customer.billingAddress || '—'}
            </p>
          </div>
          <div className="field">
            <span className="label">Shipping address</span>
            <p className="subtle" style={{ margin: 0 }}>
              {customer.shippingAddress || '—'}
            </p>
          </div>
        </div>
      </section>

      {status && (
        <section className="surface-card" role="status" aria-live="polite">
          <p style={{ margin: 0 }}>{status}</p>
        </section>
      )}

      <div className="sticky-actions invoice-actions">
        <button className="btn btn-secondary" type="button" onClick={() => setIsActionsOpen(true)}>
          Actions
        </button>
        <button className="btn btn-primary" type="button" onClick={handleCreateInvoice}>
          Create invoice
        </button>
      </div>

      {isActionsOpen && (
        <Modal title="Client actions" onClose={() => setIsActionsOpen(false)}>
          <div className="action-list">
            <button className="btn btn-secondary btn-full" type="button" onClick={handleEdit}>
              Edit client
            </button>
            <button className="btn btn-secondary btn-full" type="button" onClick={handleCreateInvoice}>
              Create invoice
            </button>
            <button
              className="btn btn-danger btn-full"
              type="button"
              onClick={() => {
                setIsActionsOpen(false);
                setIsDeleteOpen(true);
              }}
              disabled={!canDelete || saving}
            >
              Delete client
            </button>
            {!canDelete && (
              <p className="subtle" style={{ margin: 0 }}>
                Delete is disabled because this client has transactions.
              </p>
            )}
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Modal title="Delete client" onClose={() => setIsDeleteOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {canDelete
                ? 'This can’t be undone. The client will be removed permanently.'
                : 'This client has transactions. Deleting is disabled.'}
            </p>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={!canDelete || saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClientView;
