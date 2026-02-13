import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { getDefaultInvoiceLocationIds } from '../lib/auth';
import { buildInvoiceShareUrl, createInvoiceShareToken } from '../lib/shareApi';
import { getDefaultTemplate, safeParseConfigString } from '../lib/templatesApi';
import { resolveStorageAccessUrl } from '../lib/uploadApi';
import { useI18n } from '../i18n';
import { getInvoiceStatusKey } from '../i18n/status';
import {
  computeDueDate,
  formatInvoiceNumberShort,
  formatMoney,
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

const GET_BUSINESS = gql`
  query GetBusinessForInvoiceView {
    getBusiness {
      id
      name
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

const defaultInvoiceTemplateConfig = {
  theme: {
    primaryColor: '#1677ff',
    textColor: '#111827',
    tableHeaderBg: '#111827',
    tableHeaderText: '#ffffff',
    borderColor: '#e2e8f0'
  },
  header: {
    showLogo: true,
    logoUrl: ''
  }
};

function mergeInvoiceTemplateConfig(parsed) {
  return {
    ...defaultInvoiceTemplateConfig,
    ...parsed,
    theme: { ...defaultInvoiceTemplateConfig.theme, ...(parsed?.theme || {}) },
    header: { ...defaultInvoiceTemplateConfig.header, ...(parsed?.header || {}) }
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
  const { lang, t, tEn } = useI18n();

  const [status, setStatus] = useState('');
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [limit, setLimit] = useState(80);
  const [invoiceTemplateConfig, setInvoiceTemplateConfig] = useState(defaultInvoiceTemplateConfig);
  const isConfirmingRef = useRef(false);
  const isRecordingPaymentRef = useRef(false);
  const [paymentCompletedLocally, setPaymentCompletedLocally] = useState(false);

  const { data: businessData } = useQuery(GET_BUSINESS, { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' });
  const shouldLoadPaymentAccounts = isRecordPaymentOpen;
  const { data: bankData, loading: banksLoading, error: banksError } = useQuery(LIST_BANK_ACCOUNTS, {
    skip: !shouldLoadPaymentAccounts,
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first'
  });

  const {
    data,
    loading,
    error,
    refetch: refetchInvoice
  } = useQuery(FIND_INVOICE, {
    variables: { limit },
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
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
  const businessId = businessData?.getBusiness?.id;
  const businessName = useMemo(() => {
    const raw = businessData?.getBusiness?.name;
    if (!raw) return '';
    return String(raw).trim();
  }, [businessData?.getBusiness?.name]);

  const defaults = useMemo(() => getDefaultInvoiceLocationIds(), []);
  const fallbackBranchId = invoice?.branch?.id ?? defaults.branchId;
  const fallbackWarehouseId = invoice?.warehouse?.id ?? defaults.warehouseId;

  const branchName = invoice?.branch?.name || (fallbackBranchId ? `#${fallbackBranchId}` : '');
  const warehouseName = invoice?.warehouse?.name || (fallbackWarehouseId ? `#${fallbackWarehouseId}` : '');

  const paymentTermsLabel = useMemo(() => {
    const value = invoice?.invoicePaymentTerms;
    switch (value) {
      case 'DueOnReceipt':
        return t('invoiceForm.paymentTerms.dueOnReceipt');
      case 'Net7':
        return t('invoiceForm.paymentTerms.net7');
      case 'Net15':
        return t('invoiceForm.paymentTerms.net15');
      case 'Net30':
        return t('invoiceForm.paymentTerms.net30');
      default:
        return value || '--';
    }
  }, [invoice?.invoicePaymentTerms, t]);
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
    if (invoice?.id) return `${t('pages.invoiceView.title')} ${invoice.id}`;
    return t('pages.invoiceView.title');
  }, [invoice?.id, invoice?.invoiceNumber, t]);

  const rawStatus = invoice?.currentStatus || '';
  const statusKey = getInvoiceStatusKey(rawStatus);
  const displayStatus = statusKey ? t(statusKey) : rawStatus || t('invoiceView.unknown');
  const normalizedStatus = (rawStatus || '').toLowerCase();
  const isDraft = normalizedStatus.includes('draft');
  const isConfirmed = normalizedStatus.includes('confirmed');
  const remainingBalance = Math.max(0, Number(invoice?.remainingBalance || 0));
  const hasBalanceDue = remainingBalance > 0;
  const isPaid = isConfirmed && !hasBalanceDue;
  const canRecordPayment = isConfirmed && hasBalanceDue && !paymentCompletedLocally;
  const canShare = !isDraft;
  const canEdit = isDraft;
  const canDelete = isDraft;
  const fullPaymentAmount = remainingBalance;

  const bankAccounts = useMemo(() => {
    const rows = bankData?.listBankingAccount?.listBankingAccount || [];
    return rows.filter((account) => account?.detailType === 'Bank' && account?.isActive !== false);
  }, [bankData]);

  useEffect(() => {
    if (!businessId) return undefined;

    let cancelled = false;
    const loadTemplate = async () => {
      try {
        const template = await getDefaultTemplate('invoice', businessId);
        if (cancelled) return;
        const parsed = safeParseConfigString(template?.config_json);
        setInvoiceTemplateConfig(mergeInvoiceTemplateConfig(parsed));
      } catch {
        if (!cancelled) {
          setInvoiceTemplateConfig(defaultInvoiceTemplateConfig);
        }
      }
    };

    loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const templateTheme = invoiceTemplateConfig?.theme || defaultInvoiceTemplateConfig.theme;
  const paperLogoUrl = useMemo(() => {
    const shouldShowLogo = invoiceTemplateConfig?.header?.showLogo !== false;
    if (!shouldShowLogo) return '';
    return resolveStorageAccessUrl(invoiceTemplateConfig?.header?.logoUrl || '');
  }, [invoiceTemplateConfig?.header?.logoUrl, invoiceTemplateConfig?.header?.showLogo]);

  const invoicePaperVars = useMemo(
    () => ({
      '--invoice-template-primary': templateTheme.primaryColor || defaultInvoiceTemplateConfig.theme.primaryColor,
      '--invoice-template-text': templateTheme.textColor || defaultInvoiceTemplateConfig.theme.textColor,
      '--invoice-template-border': templateTheme.borderColor || defaultInvoiceTemplateConfig.theme.borderColor,
      '--invoice-template-table-header-bg':
        templateTheme.tableHeaderBg || templateTheme.primaryColor || defaultInvoiceTemplateConfig.theme.tableHeaderBg,
      '--invoice-template-table-header-text':
        templateTheme.tableHeaderText || defaultInvoiceTemplateConfig.theme.tableHeaderText
    }),
    [
      templateTheme.borderColor,
      templateTheme.primaryColor,
      templateTheme.tableHeaderBg,
      templateTheme.tableHeaderText,
      templateTheme.textColor
    ]
  );

  useEffect(() => {
    setPaymentCompletedLocally(false);
  }, [invoice?.id]);

  const handleShare = async () => {
    if (!invoice?.id) return;
    if (!canShare) return;
    setStatus('');
    try {
      const share = await createInvoiceShareToken(invoice.id);
      const shareUrl = buildInvoiceShareUrl(share?.token, { lang });
      if (!shareUrl) {
        throw new Error(t('invoiceForm.shareUnavailable'));
      }

      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: t('invoiceForm.shareTitle') });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      setStatus(t('invoiceView.shareReady'));
      setIsActionsOpen(false);
    } catch (err) {
      setStatus(err.message || t('invoiceView.shareFailed'));
    }
  };

  const handlePrint = () => {
    setIsActionsOpen(false);
    window.print();
  };

  const handleEdit = () => {
    if (!invoice?.id || !isDraft) return;
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
      setStatus(t('invoiceView.invoiceConfirmed'));
    } catch (err) {
      setStatus(err.message || t('invoiceView.confirmFailed'));
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
    const paymentModeId = 0;

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
      setStatus(t('invoiceView.unableRecordPaymentMissing'));
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
      setStatus(t('invoiceView.paymentRecorded'));
    } catch (err) {
      setStatus(err.message || t('invoiceView.paymentFailed'));
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
      setStatus(err.message || t('invoiceView.deleteFailed'));
    }
  };

  const isRecordingPayment = paymentState.loading || isRecordingPaymentRef.current;
  const saving = confirmState.loading || deleteState.loading || isConfirmingRef.current || isRecordingPayment;
  const showPaidState = isPaid || paymentCompletedLocally;

  const primaryActionLabel = isDraft
    ? saving
      ? t('invoiceView.confirming')
      : t('invoiceView.confirm')
    : canRecordPayment
      ? isRecordingPayment
        ? t('invoiceView.recording')
        : t('invoiceView.recordPayment')
      : showPaidState
        ? t('invoiceView.paid')
        : t('invoiceView.confirmed');

  const primaryActionClassName = isDraft ? 'btn btn-primary' : canRecordPayment ? 'btn btn-record-payment' : 'btn btn-primary';
  const nextActionHint = isDraft
    ? t('invoiceView.nextDraft')
    : canRecordPayment
      ? t('invoiceView.nextRecord')
      : showPaidState
        ? t('invoiceView.nextPaid')
        : t('invoiceView.nextConfirmed');

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
          <p className="state-title">{t('invoiceView.notFoundTitle')}</p>
          <p className="state-message">{t('invoiceView.notFoundMessage')}</p>
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
            <button className="btn btn-primary" type="button" onClick={() => navigate('/')}>
              {t('invoiceView.backToInvoices')}
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
          <p className="state-title">{t('invoiceView.couldNotLoadTitle')}</p>
          <p className="state-message">{error?.message || t('invoiceView.invoiceNotFound')}</p>
          <div className="state-actions">
            <button className="btn btn-secondary" type="button" onClick={() => refetchInvoice()}>
              {t('common.tryAgain')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack invoice-view">
      <section className="card invoice-meta">
        <div className="invoice-meta-top">
          <div style={{ minWidth: 0 }}>
            <p className="kicker">{t('invoiceView.metaKicker')}</p>
            <h2 className="title" style={{ marginBottom: 0 }}>
              {displayNumber}
            </h2>
          </div>
          <span className={`badge ${statusClass(rawStatus)}`}>{displayStatus}</span>
        </div>

        <div className="invoice-meta-chips">
          {branchName && (
            <span className="meta-chip">
              {t('invoiceView.branch')}: {branchName}
            </span>
          )}
          {warehouseName && (
            <span className="meta-chip">
              {t('invoiceView.warehouseLabel')}: {warehouseName}
            </span>
          )}
          <span className="meta-chip">
            {t('invoiceView.date')}: {formatShortDate(invoice.invoiceDate)}
          </span>
          <span className="meta-chip">
            {t('invoiceView.terms')}: {paymentTermsLabel}
          </span>
        </div>
      </section>

      <section className="invoice-paper-wrap" aria-label={t('invoiceView.invoicePaperAria')}>
        <div className="invoice-paper invoice-paper-template" style={invoicePaperVars}>
          <div className="invoice-paper-head">
            <div className="invoice-paper-brand" aria-label="Business identity">
              {paperLogoUrl && <img src={paperLogoUrl} alt="" className="invoice-paper-logo-image" loading="lazy" />}
              {businessName && <p className="invoice-paper-brand-title">{businessName}</p>}
            </div>

            <div className="invoice-paper-title">
              <div className="invoice-paper-heading">{tEn('templatePreview.invoice')}</div>
              <div className="invoice-paper-number"># {displayNumber}</div>
              <div className="invoice-paper-balance">
                <div className="invoice-paper-balance-label">{t('invoiceView.remainingBalance')}</div>
                <div className="invoice-paper-balance-value">{formatMoney(invoice.remainingBalance, baseCurrency)}</div>
              </div>
              <span className={`badge ${statusClass(rawStatus)} invoice-paper-status`}>{displayStatus}</span>
            </div>
          </div>

          <div className="invoice-paper-grid">
            <div className="invoice-paper-block">
              <div className="invoice-paper-block-label">{t('invoiceView.billTo')}</div>
              <div className="invoice-paper-block-value">{invoice.customer?.name || '--'}</div>
            </div>

            <div className="invoice-paper-block">
              <div className="invoice-paper-block-row">
                <span>{t('invoiceView.invoiceDate')}</span>
                <span>{formatShortDate(invoice.invoiceDate)}</span>
              </div>
              <div className="invoice-paper-block-row">
                <span>{t('invoiceView.paymentTerms')}</span>
                <span>{paymentTermsLabel}</span>
              </div>
              <div className="invoice-paper-block-row">
                <span>{t('invoiceView.dueDate')}</span>
                <span>{dueDate ? formatShortDate(dueDate.toISOString()) : '--'}</span>
              </div>
              <div className="invoice-paper-block-row">
                <span>{t('invoiceView.warehouseLabel')}</span>
                <span>{warehouseName || '--'}</span>
              </div>
            </div>
          </div>

          <div className="invoice-table" role="table" aria-label={t('invoiceView.tableAria')}>
            <div className="invoice-table-row invoice-table-head" role="row">
              <div role="columnheader">#</div>
              <div role="columnheader">{t('invoiceView.item')}</div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                {t('invoiceView.qty')}
              </div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                {t('invoiceView.rate')}
              </div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                {t('invoiceView.amount')}
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
                      {t('invoiceView.qty')} {qty} · {t('invoiceView.rate')} {formatMoney(rate, baseCurrency)}
                      {discount ? ` · ${t('invoiceView.discount')} ${formatMoney(discount, baseCurrency)}` : ''}
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
                <span>{t('invoiceView.subTotal')}</span>
                <span>{formatMoney(totals.subtotal, baseCurrency)}</span>
              </div>
              <div className="invoice-total-row">
                <span>{t('invoiceView.discount')}</span>
                <span>-{formatMoney(totals.discount, baseCurrency)}</span>
              </div>
              <div className="invoice-total-row invoice-total-strong">
                <span>{t('invoiceView.total')}</span>
                <span>{formatMoney(totals.total, baseCurrency)}</span>
              </div>
              <div className="invoice-total-row">
                <span>{t('invoiceView.remaining')}</span>
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

      <section className="surface-card flow-note-card" aria-label={t('invoiceView.nextActionKicker')}>
        <p className="kicker">{t('invoiceView.nextActionKicker')}</p>
        <p style={{ margin: 0 }} className="subtle">
          {nextActionHint}
        </p>
      </section>

      <button
        className="fab fab-send"
        type="button"
        onClick={handleShare}
        disabled={!canShare || saving}
        aria-label={t('invoiceView.sendInvoiceLink')}
        title={canShare ? t('invoiceView.sendInvoiceLinkTitle') : t('invoiceView.sendEnableHint')}
      >
        <SendIcon />
      </button>

      <div className="sticky-actions invoice-actions">
        <button className="btn btn-secondary" type="button" onClick={() => setIsActionsOpen(true)}>
          {t('common.actions')}
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
        <Modal title={t('invoiceView.invoiceActionsTitle')} onClose={() => setIsActionsOpen(false)}>
          <div className="action-list">
            {canEdit && (
              <button className="btn btn-secondary btn-full" type="button" onClick={handleEdit} disabled={saving}>
                {t('invoiceView.editInvoice')}
              </button>
            )}

            {canShare && (
              <button className="btn btn-secondary btn-full" type="button" onClick={handleShare} disabled={saving}>
                {t('invoiceView.shareLink')}
              </button>
            )}

            {canRecordPayment && (
              <button
                className="btn btn-record-payment btn-full"
                type="button"
                onClick={() => setIsRecordPaymentOpen(true)}
                disabled={saving}
              >
                {isRecordingPayment ? t('invoiceView.recording') : t('invoiceView.recordPayment')}
              </button>
            )}
            <button className="btn btn-secondary btn-full" type="button" onClick={handlePrint}>
              {t('invoiceView.pdfPrint')}
            </button>

            {canDelete && (
              <button
                className="btn btn-danger btn-full"
                type="button"
                onClick={() => {
                  setIsDeleteOpen(true);
                }}
                disabled={saving}
              >
                {t('invoiceView.deleteInvoice')}
              </button>
            )}
          </div>
        </Modal>
      )}

      {isConfirmOpen && (
        <Modal title={t('invoiceView.confirmInvoiceTitle')} onClose={() => setIsConfirmOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {t('invoiceView.confirmInvoiceCopy')}
            </p>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsConfirmOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" type="button" onClick={handleConfirm} disabled={saving}>
                {saving ? t('invoiceView.confirming') : t('invoiceView.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isRecordPaymentOpen && (
        <Modal title={t('invoiceView.recordPaymentTitle')} onClose={() => setIsRecordPaymentOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {t('invoiceView.recordPaymentCopy')}
            </p>

            {banksLoading && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">{t('invoiceView.loadingPaymentOptions')}</p>
              </section>
            )}

            {banksError && (
              <section className="state-error" role="alert">
                <p className="state-title">{t('invoiceView.couldNotLoadPaymentOptions')}</p>
                <p className="state-message">{banksError?.message}</p>
              </section>
            )}

            {!banksLoading && !banksError && bankAccounts.length === 0 && (
              <section className="state-empty" role="status">
                <p className="state-title">{t('invoiceView.noBankAccountsTitle')}</p>
                <p className="state-message">{t('invoiceView.noBankAccountsCopy')}</p>
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
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Modal title={t('invoiceView.deleteInvoiceTitle')} onClose={() => setIsDeleteOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {t('invoiceView.deleteInvoiceCopy')}
            </p>
            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-danger" type="button" onClick={handleDelete} disabled={!isDraft || saving}>
                {saving ? t('invoiceView.deleting') : t('invoiceView.delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default InvoiceView;
