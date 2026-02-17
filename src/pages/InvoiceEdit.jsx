import { useEffect, useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import InvoiceForm from './InvoiceForm';
import { createLine, useInvoiceDraft } from '../state/invoiceDraft';
import { useI18n } from '../i18n';

const FIND_INVOICE = gql`
  query FindInvoiceForEdit($limit: Int = 120) {
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          invoiceNumber
          invoiceDate
          invoicePaymentTerms
          currentStatus
          customer {
            id
            name
          }
          details {
            id
            name
            detailQty
            detailUnitRate
            detailDiscount
            detailDiscountType
          }
        }
      }
    }
  }
`;

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function InvoiceEdit() {
  const { t } = useI18n();
  const { id } = useParams();
  const { state, dispatch } = useInvoiceDraft();
  const [isHydrated, setIsHydrated] = useState(() => String(state.invoiceId || '') === String(id || ''));
  const [limit, setLimit] = useState(120);

  const { data, loading, error, refetch } = useQuery(FIND_INVOICE, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const invoice = useMemo(() => {
    const edges = data?.paginateSalesInvoice?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [data, id]);
  const hasDraftForInvoice = String(state.invoiceId || '') === String(invoice?.id || id || '');

  const draft = useMemo(() => {
    if (!invoice) return null;

    const lines = Array.isArray(invoice.details)
      ? invoice.details.map((detail, index) => ({
          id: `detail-${detail.id ?? index}`,
          productId: '',
          name: detail.name || '',
          qty: Number(detail.detailQty ?? 0),
          rate: Number(detail.detailUnitRate ?? 0),
          discount: Number(detail.detailDiscount ?? 0),
          discountType: detail.detailDiscountType || 'A',
          taxable: true
        }))
      : [];

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceDate: toDateInputValue(invoice.invoiceDate) || new Date().toISOString().slice(0, 10),
      paymentTerms: invoice.invoicePaymentTerms || 'DueOnReceipt',
      customerId: invoice.customer?.id || '',
      customerName: invoice.customer?.name || '',
      referenceNumber: invoice.referenceNumber || '',
      notes: '',
      branchId: invoice.branchId ?? state.branchId,
      warehouseId: invoice.warehouseId ?? state.warehouseId,
      currencyId: invoice.currencyId ?? state.currencyId,
      currentStatus: invoice.currentStatus || 'Draft',
      lines: lines.length > 0 ? lines : [createLine()]
    };
  }, [invoice, state.branchId, state.currencyId, state.warehouseId]);

  useEffect(() => {
    setIsHydrated(String(state.invoiceId || '') === String(id || ''));
  }, [id, state.invoiceId]);

  useEffect(() => {
    if (!invoice) return;
    if (String(state.invoiceId || '') === String(invoice.id)) {
      setIsHydrated(true);
      return;
    }
    if (!draft) return;
    dispatch({ type: 'hydrate', invoice: draft });
    setIsHydrated(true);
  }, [dispatch, draft, invoice, state.invoiceId]);

  useEffect(() => {
    if (loading || error) return;
    if (!invoice && limit < 640) {
      setLimit((prev) => Math.min(prev * 2, 640));
    }
  }, [error, invoice, limit, loading]);

  if ((loading && !data && !hasDraftForInvoice) || !isHydrated) {
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

  if (!loading && !error && !invoice) {
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('invoiceView.notFoundTitle')}</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{t('invoiceEdit.returnAndRefresh')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>{t('invoiceView.couldNotLoadTitle')}</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{error?.message || t('invoiceView.invoiceNotFound')}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            {t('common.tryAgain')}
          </button>
        </section>
      </div>
    );
  }

  return <InvoiceForm />;
}

export default InvoiceEdit;
