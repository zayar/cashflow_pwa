import { useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();

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
      setStatus(err.message || t('itemView.failedDelete'));
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
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('itemView.notFoundTitle')}</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            {t('itemView.notFoundMessage')}
          </p>
          <div className="toolbar" style={{ justifyContent: 'center', gap: 10 }}>
            {canLoadMore && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setLimit((prev) => Math.min(prev * 2, 640))}
              >
                {t('common.loadMore')}
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => navigate('/items')}>
              {t('itemView.backToItems')}
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
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('itemView.couldNotLoadTitle')}</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{error?.message || t('itemView.itemNotFound')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.tryAgain')}
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
            <p className="kicker">{t('itemView.kicker')}</p>
            <h2 className="title">{product.name || t('pages.itemView.title')}</h2>
          </div>
          <span className={`badge ${product.isActive ? 'badge-success' : 'badge-neutral'}`}>
            {product.isActive ? t('itemView.active') : t('itemView.inactive')}
          </span>
        </div>
        <div className="list-meta">
          {product.sku && <span className="meta-chip">SKU: {product.sku}</span>}
          <span className="meta-chip">
            {t('itemView.itemId')} {product.id}
          </span>
        </div>
      </section>

      <section className="surface-card">
        <div className="form-grid">
          <div className="field">
            <span className="label">{t('itemView.salesPrice')}</span>
            <p className="subtle" style={{ margin: 0 }}>
              {formatCurrency(product.salesPrice)}
            </p>
          </div>
          <div className="field">
            <span className="label">{t('itemView.purchasePrice')}</span>
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
          {t('common.actions')}
        </button>
        <button className="btn btn-primary" type="button" onClick={handleEdit}>
          {t('common.edit')}
        </button>
      </div>

      {isActionsOpen && (
        <Modal title={t('itemView.itemActionsTitle')} onClose={() => setIsActionsOpen(false)}>
          <div className="action-list">
            <button className="btn btn-secondary btn-full" type="button" onClick={handleEdit}>
              {t('itemView.editItem')}
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
              {t('itemView.deleteItem')}
            </button>
            {!canDelete && (
              <p className="subtle" style={{ margin: 0 }}>
                {t('itemView.deleteDisabledReason')}
              </p>
            )}
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Modal title={t('itemView.deleteTitle')} onClose={() => setIsDeleteOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {canDelete
                ? t('itemView.deleteCopyAllowed')
                : t('itemView.deleteCopyBlocked')}
            </p>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={!canDelete || saving}>
                {saving ? t('invoiceView.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ItemView;
