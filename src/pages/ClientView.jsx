import { useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { useInvoiceDraft } from '../state/invoiceDraft';
import { useI18n } from '../i18n';
import { formatMoney } from '../lib/formatters';

const FIND_CUSTOMER = gql`
  query FindCustomer($limit: Int = 80) {
    paginateCustomer(limit: $limit) {
      edges {
        node {
          id
          name
          email
          phone
          billingAddress {
            attention
            address
            city
            country
            state {
              stateNameEn
            }
            township {
              townshipNameEn
            }
            phone
            email
          }
          shippingAddress {
            attention
            address
            city
            country
            state {
              stateNameEn
            }
            township {
              townshipNameEn
            }
            phone
            email
          }
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



function formatAddress(address) {
  if (!address) return '—';
  const parts = [
    address.attention,
    address.address,
    address.city,
    address.state?.stateNameEn,
    address.township?.townshipNameEn,
    address.country
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function ClientView() {
  const navigate = useNavigate();
  const { dispatch } = useInvoiceDraft();
  const { id } = useParams();
  const { t } = useI18n();

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
	      setStatus(err.message || t('clientView.failedDelete'));
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
	          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('clientView.notFoundTitle')}</p>
	          <p style={{ marginTop: 0, marginBottom: 14 }}>
	            {t('clientView.notFoundMessage')}
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
	            <button className="btn btn-primary" type="button" onClick={() => navigate('/clients')}>
	              {t('clientView.backToClients')}
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
	          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('clientView.couldNotLoadTitle')}</p>
	          <p style={{ marginTop: 0, marginBottom: 14 }}>{error?.message || t('clientView.clientNotFound')}</p>
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
	            <p className="kicker">{t('clientView.kicker')}</p>
	            <h2 className="title">{customer.name || t('pages.clientView.title')}</h2>
	          </div>
	          <span className={`badge ${hasOutstanding ? 'badge-warning' : 'badge-success'}`}>
	            {hasOutstanding ? t('clientView.outstanding') : t('clientView.clear')}
	          </span>
	        </div>
	        <div className="list-meta">
	          {customer.email && (
	            <span className="meta-chip">
	              {t('clientView.email')}: {customer.email}
	            </span>
	          )}
	          {customer.phone && (
	            <span className="meta-chip">
	              {t('clientView.phone')}: {customer.phone}
	            </span>
	          )}
	          <span className="meta-chip">
	            {t('clientView.clientId')} {customer.id}
	          </span>
	          <span className="meta-chip">
	            {t('clientView.outstandingLabel')}: {formatMoney(outstanding, null)}
	          </span>
	        </div>
	      </section>

	      <section className="surface-card">
	        <div className="form-grid">
	          <div className="field">
	            <span className="label">{t('clientView.billingAddress')}</span>
	            <p className="subtle" style={{ margin: 0 }}>
	              {formatAddress(customer.billingAddress)}
	            </p>
	          </div>
	          <div className="field">
	            <span className="label">{t('clientView.shippingAddress')}</span>
	            <p className="subtle" style={{ margin: 0 }}>
	              {formatAddress(customer.shippingAddress)}
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
	        <button className="btn btn-primary" type="button" onClick={handleCreateInvoice}>
	          {t('clientView.createInvoice')}
	        </button>
	      </div>

	      {isActionsOpen && (
	        <Modal title={t('clientView.clientActionsTitle')} onClose={() => setIsActionsOpen(false)}>
	          <div className="action-list">
	            <button className="btn btn-secondary btn-full" type="button" onClick={handleEdit}>
	              {t('clientView.editClient')}
	            </button>
	            <button className="btn btn-secondary btn-full" type="button" onClick={handleCreateInvoice}>
	              {t('clientView.createInvoice')}
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
	              {t('clientView.deleteClient')}
	            </button>
	            {!canDelete && (
	              <p className="subtle" style={{ margin: 0 }}>
	                {t('clientView.deleteDisabledReason')}
	              </p>
	            )}
	          </div>
	        </Modal>
	      )}

	      {isDeleteOpen && (
	        <Modal title={t('clientView.deleteTitle')} onClose={() => setIsDeleteOpen(false)}>
	          <div className="form-grid">
	            <p className="subtle" style={{ marginTop: 0 }}>
	              {canDelete
	                ? t('clientView.deleteCopyAllowed')
	                : t('clientView.deleteCopyBlocked')}
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

export default ClientView;
