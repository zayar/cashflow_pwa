import { useEffect, useMemo, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';
import InvoiceForm from './InvoiceForm';
import { createLine, useInvoiceDraft } from '../state/invoiceDraft';

const GET_INVOICE = gql`
  query GetInvoiceForEdit($id: ID!) {
    getSalesInvoice(id: $id) {
      id
      invoiceNumber
      invoiceDate
      invoicePaymentTerms
      currentStatus
      referenceNumber
      branchId
      warehouseId
      currencyId
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
  const { id } = useParams();
  const { state, dispatch } = useInvoiceDraft();
  const [isHydrated, setIsHydrated] = useState(() => String(state.invoiceId || '') === String(id || ''));

  const { data, loading, error, refetch } = useQuery(GET_INVOICE, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const invoice = data?.getSalesInvoice;
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
      branchId: invoice.branchId,
      warehouseId: invoice.warehouseId,
      currencyId: invoice.currencyId,
      currentStatus: invoice.currentStatus || 'Draft',
      lines: lines.length > 0 ? lines : [createLine()]
    };
  }, [invoice]);

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

  if (error || !invoice) {
    return (
      <div className="stack">
        <section className="state-error" role="alert">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Could not load this invoice.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>{error?.message || 'Invoice not found.'}</p>
          <button className="btn btn-secondary" type="button" onClick={() => refetch()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return <InvoiceForm />;
}

export default InvoiceEdit;
