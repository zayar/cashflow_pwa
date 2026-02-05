import { useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';

const FIND_PRODUCT = gql`
  query FindProduct($limit: Int = 80) {
    paginateProduct(limit: $limit) {
      edges {
        node {
          id
          name
          salesPrice
          purchasePrice
          sku
          isActive
        }
      }
    }
  }
`;

const FIND_INVOICES = gql`
  query FindInvoicesForItem($limit: Int = 200) {
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          details {
            name
          }
        }
      }
    }
  }
`;

const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id) {
      id
      name
    }
  }
`;

function formatCurrency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function ItemView() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [limit, setLimit] = useState(80);
  const [status, setStatus] = useState('');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery(FIND_PRODUCT, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const { data: invoiceData } = useQuery(FIND_INVOICES, {
    variables: { limit: 200 },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const [deleteProduct, deleteState] = useMutation(DELETE_PRODUCT);

  const product = useMemo(() => {
    const edges = data?.paginateProduct?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [data, id]);

  const invoices = useMemo(() => invoiceData?.paginateSalesInvoice?.edges ?? [], [invoiceData]);
  const hasRecentTransactions = useMemo(() => {
    if (!product?.name) return false;
    return invoices.some((edge) =>
      (edge?.node?.details || []).some((detail) => detail?.name && detail.name === product.name)
    );
  }, [invoices, product?.name]);

  const canDelete = !hasRecentTransactions;

  const handleEdit = () => {
    if (!product) return;
    setIsActionsOpen(false);
    navigate(`/items/${product.id}/edit`);
  };

  const handleDelete = async () => {
    if (!product || !canDelete) return;
    setStatus('');
    try {
      await deleteProduct({ variables: { id: product.id } });
      navigate('/items', { replace: true, state: { deleted: true } });
    } catch (err) {
      setStatus(err.message || 'Failed to delete item.');
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

  if (!loading && !error && !product) {
    const canLoadMore = limit < 640;
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Item not found in recent items.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            Tap load more to search further back, or return to items.
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
            <button className="btn btn-primary" type="button" onClick={() => navigate('/items')}>
              Back to items
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load this item.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{error?.message || 'Item not found.'}</p>
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
            <p className="kicker">Catalog</p>
            <h2 className="title">{product.name || 'Item'}</h2>
          </div>
          <span className={`badge ${product.isActive ? 'badge-success' : 'badge-neutral'}`}>
            {product.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="list-meta">
          {product.sku && <span className="meta-chip">SKU: {product.sku}</span>}
          <span className="meta-chip">Item ID {product.id}</span>
        </div>
      </section>

      <section className="surface-card">
        <div className="form-grid">
          <div className="field">
            <span className="label">Sales price</span>
            <p className="subtle" style={{ margin: 0 }}>
              {formatCurrency(product.salesPrice)}
            </p>
          </div>
          <div className="field">
            <span className="label">Purchase price</span>
            <p className="subtle" style={{ margin: 0 }}>
              {formatCurrency(product.purchasePrice)}
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
        <button className="btn btn-primary" type="button" onClick={handleEdit}>
          Edit
        </button>
      </div>

      {isActionsOpen && (
        <Modal title="Item actions" onClose={() => setIsActionsOpen(false)}>
          <div className="action-list">
            <button className="btn btn-secondary btn-full" type="button" onClick={handleEdit}>
              Edit item
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
              Delete item
            </button>
            {!canDelete && (
              <p className="subtle" style={{ margin: 0 }}>
                Delete is disabled because this item has transactions.
              </p>
            )}
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Modal title="Delete item" onClose={() => setIsDeleteOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {canDelete
                ? 'This can’t be undone. The item will be removed permanently.'
                : 'This item has transactions. Deleting is disabled.'}
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

export default ItemView;
