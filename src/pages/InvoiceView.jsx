import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { getDefaultInvoiceLocationIds, getUsername } from '../lib/auth';
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
          branch {
            id
            name
          }
          warehouse {
            id
            name
          }
          currency {
            id
            name
            symbol
          }
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

const LIST_BANK_ACCOUNTS = gql`
  query ListBankingAccountForInvoice {
    listBankingAccount {
      listBankingAccount {
        id
        name
        detailType
        isActive
        accountNumber
        currency {
          id
          name
          symbol
        }
      }
    }
  }
`;

const LIST_PAYMENT_MODES = gql`
  query ListPaymentModesForInvoice {
    listAllPaymentMode {
      id
      name
      isActive
    }
  }
`;

const CONFIRM_INVOICE = gql`
  mutation ConfirmInvoice($id: ID!) {
    confirmSalesInvoice(id: $id) {
      id
      invoiceNumber
      currentStatus
    }
  }
`;

const CREATE_CUSTOMER_PAYMENT = gql`
  mutation CreateCustomerPaymentFromInvoice($input: NewCustomerPayment!) {
    createCustomerPayment(input: $input) {
      id
      amount
      paymentDate
      paymentNumber
      paidInvoices {
        id
        paidAmount
        invoice {
          id
          currentStatus
          remainingBalance
        }
      }
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
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [limit, setLimit] = useState(80);
  const isConfirmingRef = useRef(false);
  const isRecordingPaymentRef = useRef(false);
  const [paymentCompletedLocally, setPaymentCompletedLocally] = useState(false);

  const { data: businessData } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-and-network' });
  const { data: locationData } = useQuery(GET_LOCATIONS, { fetchPolicy: 'cache-and-network' });
  const { data: bankData, loading: banksLoading, error: banksError } = useQuery(LIST_BANK_ACCOUNTS, {
    fetchPolicy: 'cache-and-network'
  });
  const { data: paymentModeData } = useQuery(LIST_PAYMENT_MODES, { fetchPolicy: 'cache-and-network' });

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

  const [confirmInvoice, confirmState] = useMutation(CONFIRM_INVOICE);
  const [createCustomerPayment, paymentState] = useMutation(CREATE_CUSTOMER_PAYMENT);
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
  const fallbackBranchId = invoice?.branch?.id ?? defaults.branchId;
  const fallbackWarehouseId = invoice?.warehouse?.id ?? defaults.warehouseId;

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
  const isConfirmed = normalizedStatus.includes('confirmed');
  const remainingBalance = Math.max(0, Number(invoice?.remainingBalance || 0));
  const hasBalanceDue = remainingBalance > 0;
  const isPaid = isConfirmed && !hasBalanceDue;
  const canRecordPayment = isConfirmed && hasBalanceDue && !paymentCompletedLocally;
  const canShare = !isDraft;
  const canEdit = isDraft;
  const fullPaymentAmount = remainingBalance;

  const bankAccounts = useMemo(() => {
    const rows = bankData?.listBankingAccount?.listBankingAccount || [];
    return rows.filter((account) => account?.detailType === 'Bank' && account?.isActive !== false);
  }, [bankData]);

  const activePaymentModes = useMemo(() => {
    return (paymentModeData?.listAllPaymentMode || []).filter((mode) => mode?.isActive !== false);
  }, [paymentModeData]);

  const defaultPaymentModeId = useMemo(() => {
    const bankTransfer = activePaymentModes.find((mode) => String(mode?.name || '').toLowerCase().includes('bank'));
    return Number(bankTransfer?.id || activePaymentModes[0]?.id || 0);
  }, [activePaymentModes]);

  useEffect(() => {
    setPaymentCompletedLocally(false);
  }, [invoice?.id]);

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
    if (!invoice?.id || !isDraft) return;
    if (isConfirmingRef.current) {
      return;
    }

    setStatus('');
    isConfirmingRef.current = true;
    try {
      await confirmInvoice({ variables: { id: invoice.id } });
      setIsConfirmOpen(false);
      setIsActionsOpen(false);
      await refetchInvoice();
      setStatus('Invoice confirmed.');
    } catch (err) {
      setStatus(err.message || 'Failed to confirm invoice.');
    } finally {
      isConfirmingRef.current = false;
    }
  };

  const handleRecordPayment = async (depositAccountId) => {
    if (!invoice?.id || !canRecordPayment) return;
    if (isRecordingPaymentRef.current) return;

    const branchId = Number(invoice.branch?.id || fallbackBranchId);
    const customerId = Number(invoice.customer?.id);
    const currencyId = Number(invoice.currency?.id || baseCurrency?.id);
    const normalizedDepositAccountId = Number(depositAccountId);
    const invoiceId = Number(invoice.id);
    const amount = Number(fullPaymentAmount);
    const paymentModeId = Number(defaultPaymentModeId) || 0;

    const hasRequiredIds =
      Number.isFinite(branchId) &&
      branchId > 0 &&
      Number.isFinite(customerId) &&
      customerId > 0 &&
      Number.isFinite(currencyId) &&
      currencyId > 0 &&
      Number.isFinite(normalizedDepositAccountId) &&
      normalizedDepositAccountId > 0 &&
      Number.isFinite(invoiceId) &&
      invoiceId > 0 &&
      Number.isFinite(amount) &&
      amount > 0;

    if (!hasRequiredIds) {
      setStatus('Unable to record payment. Missing branch, customer, currency, bank, or amount.');
      return;
    }

    isRecordingPaymentRef.current = true;
    setStatus('');
    try {
      await createCustomerPayment({
        variables: {
          input: {
            branchId,
            customerId,
            currencyId,
            amount,
            paymentDate: new Date().toISOString(),
            depositAccountId: normalizedDepositAccountId,
            paymentModeId,
            exchangeRate: 1,
            bankCharges: 0,
            paidInvoices: [
              {
                invoiceId,
                paidAmount: amount
              }
            ]
          }
        }
      });
      setPaymentCompletedLocally(true);
      setIsRecordPaymentOpen(false);
      setIsActionsOpen(false);
      await refetchInvoice();
      setStatus('Payment recorded.');
    } catch (err) {
      setStatus(err.message || 'Failed to record payment.');
    } finally {
      isRecordingPaymentRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (!invoice?.id || !isDraft) return;
    setStatus('');
    try {
      await deleteInvoice({ variables: { id: invoice.id } });
      navigate('/', { replace: true });
    } catch (err) {
      setStatus(err.message || 'Failed to delete invoice.');
    }
  };

  const isRecordingPayment = paymentState.loading || isRecordingPaymentRef.current;
  const saving = confirmState.loading || deleteState.loading || isConfirmingRef.current || isRecordingPayment;
  const showPaidState = isPaid || paymentCompletedLocally;

  const primaryActionLabel = isDraft
    ? saving
      ? 'Confirming...'
      : 'Confirm'
    : canRecordPayment
      ? isRecordingPayment
        ? 'Recording...'
        : 'Record Payment'
      : showPaidState
        ? 'Paid'
        : 'Confirmed';

  const primaryActionClassName = isDraft ? 'btn btn-primary' : canRecordPayment ? 'btn btn-record-payment' : 'btn btn-primary';

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
          className={primaryActionClassName}
          type="button"
          onClick={() => {
            if (isDraft) {
              setIsConfirmOpen(true);
              return;
            }
            if (canRecordPayment) {
              setIsRecordPaymentOpen(true);
            }
          }}
          disabled={saving || (!isDraft && !canRecordPayment)}
        >
          {primaryActionLabel}
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

            {canRecordPayment && (
              <button
                className="btn btn-record-payment btn-full"
                type="button"
                onClick={() => setIsRecordPaymentOpen(true)}
                disabled={saving}
              >
                {isRecordingPayment ? 'Recording...' : 'Record Payment'}
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
              disabled={!isDraft || saving}
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

      {isRecordPaymentOpen && (
        <Modal title="Record payment" onClose={() => setIsRecordPaymentOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              Select a bank account to record full payment for this invoice.
            </p>

            {banksLoading && <p className="subtle">Loading payment options...</p>}

            {banksError && (
              <section className="state-error" role="alert">
                <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>Could not load payment options.</p>
                <p style={{ margin: 0 }}>{banksError?.message}</p>
              </section>
            )}

            {!banksLoading && !banksError && bankAccounts.length === 0 && (
              <section className="state-empty" role="status">
                <p style={{ marginTop: 0, marginBottom: 8, fontWeight: 700 }}>No bank accounts found.</p>
                <p style={{ margin: 0 }}>Add a bank account from More {'>'} Bank Accounts first.</p>
              </section>
            )}

            {bankAccounts.length > 0 && (
              <div className="action-list">
                {bankAccounts.map((account) => {
                  const accountId = Number(account?.id || 0);
                  const subtitle = [account?.accountNumber, account?.currency?.symbol].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={account.id}
                      className="btn btn-secondary btn-full bank-select-option"
                      type="button"
                      onClick={() => handleRecordPayment(accountId)}
                      disabled={saving}
                    >
                      <span>{account?.name || `Bank #${account.id}`}</span>
                      {subtitle && <span className="bank-select-meta">{subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsRecordPaymentOpen(false)} disabled={saving}>
                Cancel
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
              <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={!isDraft || saving}>
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
