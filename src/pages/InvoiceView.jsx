import { useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { getDefaultInvoiceCurrencyId, getDefaultInvoiceLocationIds, getUsername } from '../lib/auth';
import { buildInvoiceShareUrl, createInvoiceShareToken } from '../lib/shareApi';
import {
  computeDueDate,
  formatInvoiceNumberShort,
  formatMoney,
  formatPaymentTerms,
  formatShortDate
} from '../lib/formatters';

const FIND_INVOICE = gql`
  query FindInvoice($limit: Int = 80) {
    paginateSalesInvoice(limit: $limit) {
      edges {
        node {
          id
          invoiceNumber
          invoiceDate
          invoicePaymentTerms
          currentStatus
          invoiceTotalAmount
          remainingBalance
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
    }
  }
`;

const GET_LOCATIONS = gql`
  query GetLocations {
    listAllBranch {
      id
      name
    }
    listAllWarehouse {
      id
      name
    }
  }
`;

const GET_BUSINESS = gql`
  query GetBusinessForInvoiceView {
    getBusiness {
      id
      baseCurrency {
        id
        name
        symbol
      }
    }
  }
`;

const UPDATE_INVOICE = gql`
  mutation UpdateInvoice($id: ID!, $input: NewSalesInvoice!) {
    updateSalesInvoice(id: $id, input: $input) {
      id
      invoiceNumber
      currentStatus
    }
  }
`;

const DELETE_INVOICE = gql`
  mutation DeleteInvoice($id: ID!) {
    deleteSalesInvoice(id: $id) {
      id
      invoiceNumber
    }
  }
`;

function buildInvoiceInput(invoice) {
  if (!invoice) return null;

  const defaults = getDefaultInvoiceLocationIds();
  const fallbackCurrencyId = getDefaultInvoiceCurrencyId();
  const isoDate = invoice.invoiceDate || new Date().toISOString();

  return {
    customerId: Number(invoice.customer?.id),
    branchId: Number(invoice.branchId ?? defaults.branchId),
    warehouseId: Number(invoice.warehouseId ?? defaults.warehouseId),
    currencyId: Number(invoice.currencyId ?? fallbackCurrencyId),
    invoiceDate: isoDate,
    invoicePaymentTerms: invoice.invoicePaymentTerms || 'DueOnReceipt',
    currentStatus: invoice.currentStatus,
    referenceNumber: invoice.referenceNumber || undefined,
    isTaxInclusive: false,
    details: (invoice.details || []).map((line) => ({
      name: line.name,
      detailQty: Number(line.detailQty) || 0,
      detailUnitRate: Number(line.detailUnitRate) || 0,
      detailDiscount: Number(line.detailDiscount) || 0
    }))
  };
}

function statusClass(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('paid')) return 'badge-success';
  if (normalized.includes('draft') || normalized.includes('due')) return 'badge-warning';
  return 'badge-neutral';
}

function SendIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.4 11.2 20.2 4.6l-6.6 16.8-3-6.1-7.2-4.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10.6 15.3 20.2 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function InvoiceView() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [status, setStatus] = useState('');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [limit, setLimit] = useState(80);

  const { data: businessData } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-and-network' });
  const { data: locationData } = useQuery(GET_LOCATIONS, { fetchPolicy: 'cache-and-network' });

  const {
    data,
    loading,
    error,
    refetch: refetchInvoice
  } = useQuery(FIND_INVOICE, {
    variables: { limit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const [updateInvoice, updateState] = useMutation(UPDATE_INVOICE);
  const [deleteInvoice, deleteState] = useMutation(DELETE_INVOICE);

  const invoice = useMemo(() => {
    const edges = data?.paginateSalesInvoice?.edges ?? [];
    const match = edges.find((edge) => String(edge?.node?.id || '') === String(id || ''));
    return match?.node || null;
  }, [data, id]);
  const baseCurrency = businessData?.getBusiness?.baseCurrency;

  const accountLabel = useMemo(() => getUsername(), []);
  const accountTitle = useMemo(() => {
    if (!accountLabel) return '';
    const trimmed = String(accountLabel).trim();
    if (!trimmed) return '';
    return trimmed.split('--')[0] || trimmed;
  }, [accountLabel]);

  const branches = locationData?.listAllBranch ?? [];
  const warehouses = locationData?.listAllWarehouse ?? [];

  const defaults = useMemo(() => getDefaultInvoiceLocationIds(), []);
  const fallbackBranchId = invoice?.branchId ?? defaults.branchId;
  const fallbackWarehouseId = invoice?.warehouseId ?? defaults.warehouseId;

  const branchName = useMemo(() => {
    if (!fallbackBranchId) return '';
    const match = branches.find((branch) => String(branch.id) === String(fallbackBranchId));
    return match?.name || `Branch #${fallbackBranchId}`;
  }, [branches, fallbackBranchId]);

  const warehouseName = useMemo(() => {
    if (!fallbackWarehouseId) return '';
    const match = warehouses.find((warehouse) => String(warehouse.id) === String(fallbackWarehouseId));
    return match?.name || `Warehouse #${fallbackWarehouseId}`;
  }, [fallbackWarehouseId, warehouses]);

  const paymentTermsLabel = formatPaymentTerms(invoice?.invoicePaymentTerms);
  const dueDate = computeDueDate(invoice?.invoiceDate, invoice?.invoicePaymentTerms);

  const totals = useMemo(() => {
    const lines = invoice?.details ?? [];
    const subtotal = lines.reduce((sum, line) => sum + Number(line.detailQty || 0) * Number(line.detailUnitRate || 0), 0);
    const discount = lines.reduce((sum, line) => sum + Number(line.detailDiscount || 0), 0);
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }, [invoice?.details]);

  const displayNumber = useMemo(() => {
    if (invoice?.invoiceNumber) return formatInvoiceNumberShort(invoice.invoiceNumber);
    if (invoice?.id) return `Invoice ${invoice.id}`;
    return 'Invoice';
  }, [invoice?.id, invoice?.invoiceNumber]);

  const statusLabel = invoice?.currentStatus || 'Unknown';
  const normalizedStatus = (statusLabel || '').toLowerCase();
  const isDraft = normalizedStatus.includes('draft');
  const canShare = !isDraft;
  const canEdit = isDraft;

  const handleShare = async () => {
    if (!invoice?.id) return;
    if (!canShare) return;
    setStatus('');
    try {
      const share = await createInvoiceShareToken(invoice.id);
      const shareUrl = buildInvoiceShareUrl(share?.token);
      if (!shareUrl) {
        throw new Error('Share link is unavailable.');
      }

      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: 'Invoice' });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      setStatus('Share link ready.');
      setIsActionsOpen(false);
    } catch (err) {
      setStatus(err.message || 'Failed to generate share link.');
    }
  };

  const handlePrint = () => {
    setIsActionsOpen(false);
    window.print();
  };

  const handleEdit = () => {
    if (!invoice?.id) return;
    setIsActionsOpen(false);
    navigate(`/invoices/${invoice.id}/edit?step=items`);
  };

  const handleConfirm = async () => {
    if (!invoice?.id) return;
    const input = buildInvoiceInput(invoice);
    if (!input) return;

    const requiredOk =
      Number.isFinite(input.customerId) &&
      input.customerId > 0 &&
      Number.isFinite(input.branchId) &&
      input.branchId > 0 &&
      Number.isFinite(input.warehouseId) &&
      input.warehouseId > 0 &&
      Number.isFinite(input.currencyId) &&
      input.currencyId > 0 &&
      Array.isArray(input.details) &&
      input.details.length > 0;

    if (!requiredOk) {
      setStatus('Missing invoice defaults (branch/warehouse/currency). Open Edit and set defaults, then confirm.');
      setIsConfirmOpen(false);
      setIsActionsOpen(false);
      return;
    }

    setStatus('');
    try {
      await updateInvoice({
        variables: {
          id: invoice.id,
          input: {
            ...input,
            currentStatus: 'Confirmed'
          }
        }
      });
      setIsConfirmOpen(false);
      setIsActionsOpen(false);
      await refetchInvoice();
      setStatus('Invoice confirmed.');
    } catch (err) {
      setStatus(err.message || 'Failed to confirm invoice.');
    }
  };

  const handleDelete = async () => {
    if (!invoice?.id) return;
    setStatus('');
    try {
      await deleteInvoice({ variables: { id: invoice.id } });
      navigate('/', { replace: true });
    } catch (err) {
      setStatus(err.message || 'Failed to delete invoice.');
    }
  };

  const saving = updateState.loading || deleteState.loading;

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

  if (!loading && !error && !invoice) {
    const canLoadMore = limit < 640;
    return (
      <div className="stack">
        <section className="state-empty" role="status">
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 800 }}>Invoice not found in recent invoices.</p>
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            Tap load more to search further back, or return to invoices.
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
            <button className="btn btn-primary" type="button" onClick={() => navigate('/')}>
              Back to invoices
            </button>
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
          <button className="btn btn-secondary" type="button" onClick={() => refetchInvoice()}>
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="stack invoice-view">
      <section className="card invoice-meta">
        <div className="invoice-meta-top">
          <div style={{ minWidth: 0 }}>
            <p className="kicker">Invoice</p>
            <h2 className="title" style={{ marginBottom: 0 }}>
              {displayNumber}
            </h2>
          </div>
          <span className={`badge ${statusClass(statusLabel)}`}>{statusLabel}</span>
        </div>

        <div className="invoice-meta-chips">
          {branchName && <span className="meta-chip">Branch: {branchName}</span>}
          {warehouseName && <span className="meta-chip">Warehouse: {warehouseName}</span>}
          <span className="meta-chip">Date: {formatShortDate(invoice.invoiceDate)}</span>
          <span className="meta-chip">Terms: {paymentTermsLabel}</span>
        </div>
      </section>

      <section className="invoice-paper-wrap" aria-label="Invoice paper">
        <div className="invoice-paper">
          <div className="invoice-paper-head">
            <div className="invoice-paper-brand" aria-label="Account">
              <div>
                {accountTitle && <p className="invoice-paper-brand-title">{accountTitle}</p>}
                {accountLabel && <p className="invoice-paper-brand-subtle">{accountLabel}</p>}
              </div>
            </div>

            <div className="invoice-paper-title">
              <div className="invoice-paper-heading">INVOICE</div>
              <div className="invoice-paper-number"># {displayNumber}</div>
            </div>
          </div>

          <div className="invoice-paper-balance">
            <div className="invoice-paper-balance-label">Remaining Balance</div>
            <div className="invoice-paper-balance-value">{formatMoney(invoice.remainingBalance, baseCurrency)}</div>
          </div>

          <div className="invoice-paper-grid">
            <div className="invoice-paper-block">
              <div className="invoice-paper-block-label">Bill To</div>
              <div className="invoice-paper-block-value">{invoice.customer?.name || '--'}</div>
            </div>

            <div className="invoice-paper-block">
              <div className="invoice-paper-block-row">
                <span>Invoice Date</span>
                <span>{formatShortDate(invoice.invoiceDate)}</span>
              </div>
              <div className="invoice-paper-block-row">
                <span>Payment Terms</span>
                <span>{paymentTermsLabel}</span>
              </div>
              <div className="invoice-paper-block-row">
                <span>Due Date</span>
                <span>{dueDate ? formatShortDate(dueDate.toISOString()) : '--'}</span>
              </div>
              <div className="invoice-paper-block-row">
                <span>Warehouse</span>
                <span>{warehouseName || '--'}</span>
              </div>
            </div>
          </div>

          <div className="invoice-table" role="table" aria-label="Invoice line items">
            <div className="invoice-table-row invoice-table-head" role="row">
              <div role="columnheader">#</div>
              <div role="columnheader">Item</div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                Qty
              </div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                Rate
              </div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                Amount
              </div>
            </div>

            {(invoice.details || []).map((line, index) => {
              const qty = Number(line.detailQty || 0);
              const rate = Number(line.detailUnitRate || 0);
              const discount = Number(line.detailDiscount || 0);
              const amount = qty * rate - discount;

              return (
                <div className="invoice-table-row" role="row" key={line.id || `${index}-${line.name}`}>
                  <div className="invoice-col-index" role="cell">
                    {index + 1}
                  </div>
                  <div className="invoice-col-name" role="cell">
                    <div className="invoice-item-name">{line.name || '--'}</div>
                    <div className="invoice-item-meta">
                      Qty {qty} · Rate {formatMoney(rate, baseCurrency)}
                      {discount ? ` · Discount ${formatMoney(discount, baseCurrency)}` : ''}
                    </div>
                  </div>
                  <div className="invoice-col-qty" role="cell" style={{ textAlign: 'right' }}>
                    {qty}
                  </div>
                  <div className="invoice-col-rate" role="cell" style={{ textAlign: 'right' }}>
                    {formatMoney(rate, baseCurrency)}
                  </div>
                  <div className="invoice-col-amount" role="cell" style={{ textAlign: 'right', fontWeight: 800 }}>
                    {formatMoney(amount, baseCurrency)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="invoice-totals">
            <div className="invoice-totals-card">
              <div className="invoice-total-row">
                <span>Sub Total</span>
                <span>{formatMoney(totals.subtotal, baseCurrency)}</span>
              </div>
              <div className="invoice-total-row">
                <span>Discount</span>
                <span>-{formatMoney(totals.discount, baseCurrency)}</span>
              </div>
              <div className="invoice-total-row invoice-total-strong">
                <span>Total</span>
                <span>{formatMoney(totals.total, baseCurrency)}</span>
              </div>
              <div className="invoice-total-row">
                <span>Remaining</span>
                <span>{formatMoney(invoice.remainingBalance, baseCurrency)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {status && (
        <section className="surface-card" role="status" aria-live="polite">
          <p style={{ margin: 0 }}>{status}</p>
        </section>
      )}

      <button
        className="fab fab-send"
        type="button"
        onClick={handleShare}
        disabled={!canShare || saving}
        aria-label="Send invoice link"
        title={canShare ? 'Send invoice link' : 'Confirm invoice to enable sending'}
      >
        <SendIcon />
      </button>

      <div className="sticky-actions invoice-actions">
        <button className="btn btn-secondary" type="button" onClick={() => setIsActionsOpen(true)}>
          Actions
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          disabled={!isDraft || saving}
        >
          {isDraft ? 'Confirm' : 'Confirmed'}
        </button>
      </div>

      {isActionsOpen && (
        <Modal title="Invoice actions" onClose={() => setIsActionsOpen(false)}>
          <div className="action-list">
            <button className="btn btn-secondary btn-full" type="button" onClick={handleEdit} disabled={!canEdit || saving}>
              Edit invoice
            </button>

            {canShare && (
              <button className="btn btn-secondary btn-full" type="button" onClick={handleShare} disabled={saving}>
                Share link
              </button>
            )}
            <button className="btn btn-secondary btn-full" type="button" onClick={handlePrint}>
              PDF / Print
            </button>

            <button
              className="btn btn-danger btn-full"
              type="button"
              onClick={() => {
                setIsDeleteOpen(true);
              }}
              disabled={saving}
            >
              Delete invoice
            </button>
          </div>
        </Modal>
      )}

      {isConfirmOpen && (
        <Modal title="Confirm invoice" onClose={() => setIsConfirmOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              Confirming will lock this invoice into a confirmed state.
            </p>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsConfirmOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleConfirm} disabled={saving}>
                {saving ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Modal title="Delete invoice" onClose={() => setIsDeleteOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              This can&apos;t be undone. The invoice will be removed permanently.
            </p>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default InvoiceView;
