import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import InvoicePreview from '../components/InvoicePreview';
import InvoiceLineCard from '../components/InvoiceLineCard';
import Modal from '../components/Modal';
import { createLine, useInvoiceDraft } from '../state/invoiceDraft';
import { buildInvoiceShareUrl, createInvoiceShareToken } from '../lib/shareApi';
import { saveDefaultInvoiceCurrencyId, saveDefaultInvoiceLocationIds } from '../lib/auth';
import { useI18n } from '../i18n';

const CREATE_INVOICE = gql`
  mutation CreateInvoice($input: NewSalesInvoice!) {
    createSalesInvoice(input: $input) {
      id
      invoiceNumber
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

const GET_INVOICE_LOCATIONS = gql`
  query GetInvoiceLocations {
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

const GET_BUSINESS_DEFAULTS = gql`
  query GetBusinessDefaults {
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

const paymentTermsOptions = [
  { value: 'DueOnReceipt', labelKey: 'invoiceForm.paymentTerms.dueOnReceipt' },
  { value: 'Net7', labelKey: 'invoiceForm.paymentTerms.net7' },
  { value: 'Net15', labelKey: 'invoiceForm.paymentTerms.net15' },
  { value: 'Net30', labelKey: 'invoiceForm.paymentTerms.net30' }
];

const flowSteps = [
  { key: 'customer', labelKey: 'invoiceForm.steps.customer' },
  { key: 'items', labelKey: 'invoiceForm.steps.items' },
  { key: 'review', labelKey: 'invoiceForm.steps.review' }
];

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function parseStepParam(value) {
  if (value === 'items') return 1;
  if (value === 'review') return 2;
  return 0;
}

function toPositiveInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

function getNetworkErrorMessage(error) {
  const result = error?.networkError?.result;
  const graphqlMessage = result?.errors?.[0]?.message;
  if (graphqlMessage) return graphqlMessage;

  if (typeof result?.message === 'string' && result.message.trim()) {
    return result.message.trim();
  }

  const bodyText = error?.networkError?.bodyText;
  if (typeof bodyText === 'string') {
    try {
      const parsed = JSON.parse(bodyText);
      const parsedGraphql = parsed?.errors?.[0]?.message;
      if (parsedGraphql) return parsedGraphql;
      if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
    } catch {
      if (bodyText.trim()) return bodyText.trim();
    }
  }

  return '';
}

function InvoiceForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { state: invoice, dispatch } = useInvoiceDraft();

  const [step, setStep] = useState(() => parseStepParam(searchParams.get('step')));
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({ customer: '', lines: [] });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [branchIdInput, setBranchIdInput] = useState('');
  const [warehouseIdInput, setWarehouseIdInput] = useState('');
  const [currencyIdInput, setCurrencyIdInput] = useState('');
  const [locationInputError, setLocationInputError] = useState('');

  const [createInvoice, createState] = useMutation(CREATE_INVOICE);
  const [updateInvoice, updateState] = useMutation(UPDATE_INVOICE);
  const saving = createState.loading || updateState.loading;
  const saveError = createState.error || updateState.error;

  const {
    data: businessData,
    loading: businessLoading,
    error: businessError
  } = useQuery(GET_BUSINESS_DEFAULTS, {
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  const {
    data: locationData,
    loading: locationsLoading,
    error: locationsError
  } = useQuery(GET_INVOICE_LOCATIONS, {
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all'
  });

  const totals = useMemo(() => {
    const subtotal = invoice.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.rate || 0), 0);
    const discount = invoice.lines.reduce((sum, line) => sum + Number(line.discount || 0), 0);
    const tax = 0;
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [invoice.lines]);

  const hasCustomer = Boolean(invoice.customerId);
  const linesReady = invoice.lines.length > 0 && invoice.lines.every((line) => Boolean(line.name));

  useEffect(() => {
    if (hasCustomer && errors.customer) {
      setErrors((prev) => ({ ...prev, customer: '' }));
    }
  }, [errors.customer, hasCustomer]);

  const baseCurrency = businessData?.getBusiness?.baseCurrency;
  const baseCurrencyId = toPositiveInt(baseCurrency?.id);
  const branches = locationData?.listAllBranch ?? [];
  const warehouses = locationData?.listAllWarehouse ?? [];

  const selectedBranchId = toPositiveInt(invoice.branchId);
  const selectedWarehouseId = toPositiveInt(invoice.warehouseId);
  const selectedCurrencyId = toPositiveInt(invoice.currencyId || baseCurrencyId);

  const hasBranchSelection = selectedBranchId > 0;
  const hasWarehouseSelection = selectedWarehouseId > 0;
  const hasCurrencySelection = selectedCurrencyId > 0;
  const hasValidBranchSelection =
    hasBranchSelection &&
    (branches.length === 0 || branches.some((branch) => toPositiveInt(branch.id) === selectedBranchId));
  const hasValidWarehouseSelection =
    hasWarehouseSelection &&
    (warehouses.length === 0 || warehouses.some((warehouse) => toPositiveInt(warehouse.id) === selectedWarehouseId));
  const hasValidCurrencySelection = hasCurrencySelection && (!baseCurrencyId || selectedCurrencyId === baseCurrencyId);
  const defaultsReady = hasValidBranchSelection && hasValidWarehouseSelection && hasValidCurrencySelection;
  const reviewReady = hasCustomer && linesReady && defaultsReady;

  const selectedBranchName = useMemo(() => {
    if (!selectedBranchId) return '';
    const selected = branches.find((branch) => toPositiveInt(branch.id) === selectedBranchId);
    return selected?.name || `#${selectedBranchId}`;
  }, [branches, selectedBranchId]);

  const selectedWarehouseName = useMemo(() => {
    if (!selectedWarehouseId) return '';
    const selected = warehouses.find((warehouse) => toPositiveInt(warehouse.id) === selectedWarehouseId);
    return selected?.name || `#${selectedWarehouseId}`;
  }, [selectedWarehouseId, warehouses]);

  const selectedCurrencyLabel = useMemo(() => {
    if (!selectedCurrencyId) return t('invoiceForm.notSet');
    if (baseCurrency?.name && (!baseCurrencyId || selectedCurrencyId === baseCurrencyId)) {
      return `${baseCurrency.name}${baseCurrency.symbol ? ` (${baseCurrency.symbol})` : ''}`;
    }
    return `#${selectedCurrencyId}`;
  }, [baseCurrency?.name, baseCurrency?.symbol, baseCurrencyId, selectedCurrencyId, t]);

  const openLocationSettings = () => {
    setLocationInputError('');
    setBranchIdInput(String(invoice.branchId || ''));
    setWarehouseIdInput(String(invoice.warehouseId || ''));
    setCurrencyIdInput(String(invoice.currencyId || baseCurrencyId || ''));
    setIsLocationOpen(true);
  };

  useEffect(() => {
    if (!baseCurrencyId) return;
    const currentCurrencyId = toPositiveInt(invoice.currencyId);
    if (currentCurrencyId === baseCurrencyId) return;

    dispatch({ type: 'setField', field: 'currencyId', value: baseCurrencyId });
    saveDefaultInvoiceCurrencyId(baseCurrencyId);
  }, [baseCurrencyId, dispatch, invoice.currencyId]);

  useEffect(() => {
    if (!isLocationOpen) return;

    const branchIds = new Set(branches.map((branch) => String(branch.id)));
    const warehouseIds = new Set(warehouses.map((warehouse) => String(warehouse.id)));

    if (branches.length > 0 && (!branchIdInput || !branchIds.has(String(branchIdInput)))) {
      setBranchIdInput(String(branches[0]?.id ?? ''));
    }

    if (warehouses.length > 0 && (!warehouseIdInput || !warehouseIds.has(String(warehouseIdInput)))) {
      setWarehouseIdInput(String(warehouses[0]?.id ?? ''));
    }

    if (baseCurrencyId && toPositiveInt(currencyIdInput) !== baseCurrencyId) {
      setCurrencyIdInput(String(baseCurrencyId));
    }
  }, [branches, warehouses, branchIdInput, warehouseIdInput, baseCurrencyId, currencyIdInput, isLocationOpen]);

  const saveLocationSettings = () => {
    const nextBranchId = toPositiveInt(branchIdInput);
    const nextWarehouseId = toPositiveInt(warehouseIdInput);
    const nextCurrencyId = toPositiveInt(currencyIdInput || baseCurrencyId);

    if (!nextBranchId || !nextWarehouseId || !nextCurrencyId) {
      setLocationInputError(t('invoiceForm.locationInputInvalid'));
      return;
    }

    dispatch({ type: 'setField', field: 'branchId', value: nextBranchId });
    dispatch({ type: 'setField', field: 'warehouseId', value: nextWarehouseId });
    dispatch({ type: 'setField', field: 'currencyId', value: nextCurrencyId });
    saveDefaultInvoiceLocationIds(nextBranchId, nextWarehouseId);
    saveDefaultInvoiceCurrencyId(nextCurrencyId);
    setStatus(t('invoiceForm.invoiceDefaultsUpdated'));
    setIsLocationOpen(false);
  };

  const openCustomerPicker = () =>
    navigate(`/pick/customer?returnTo=${encodeURIComponent(location.pathname)}`);

  const openItemPicker = (lineId) =>
    navigate(
      `/pick/item?lineId=${encodeURIComponent(String(lineId))}&returnStep=items&returnTo=${encodeURIComponent(
        location.pathname
      )}`
    );

  const addLineAndPick = () => {
    const line = createLine();
    dispatch({ type: 'addLineWith', line });
    openItemPicker(line.id);
  };

  const validateCustomer = () => {
    const customerError = hasCustomer ? '' : t('invoiceForm.customerRequired');
    setErrors((prev) => ({ ...prev, customer: customerError }));
    return !customerError;
  };

  const validateLines = () => {
    const lineErrors =
      invoice.lines.length === 0
        ? ['__empty__']
        : invoice.lines.filter((line) => !line.name).map((line) => line.id);

    setErrors((prev) => ({ ...prev, lines: lineErrors }));
    return lineErrors.length === 0;
  };

  const validateBeforeSave = () => {
    const customerOk = validateCustomer();
    const linesOk = validateLines();
    return customerOk && linesOk;
  };

  const handleSave = async () => {
    setStatus('');
    if (!validateBeforeSave()) return;

    if (!hasBranchSelection || !hasWarehouseSelection || !hasCurrencySelection) {
      setStatus(t('invoiceForm.chooseDefaultsToSave'));
      openLocationSettings();
      return;
    }

    if (!hasValidBranchSelection || !hasValidWarehouseSelection || !hasValidCurrencySelection) {
      setStatus(t('invoiceForm.defaultsNoLongerValid'));
      openLocationSettings();
      return;
    }

    const branchId = selectedBranchId;
    const warehouseId = selectedWarehouseId;
    const currencyId = selectedCurrencyId;

    const isoDate = invoice.invoiceDate
      ? new Date(`${invoice.invoiceDate}T00:00:00Z`).toISOString()
      : new Date().toISOString();

    const input = {
      customerId: Number(invoice.customerId),
      branchId,
      warehouseId,
      currencyId,
      invoiceDate: isoDate,
      invoicePaymentTerms: invoice.paymentTerms,
      currentStatus: invoice.currentStatus || 'Draft',
      referenceNumber: invoice.referenceNumber || undefined,
      isTaxInclusive: false,
      details: invoice.lines.map((line) => ({
        name: line.name,
        detailQty: Number(line.qty) || 0,
        detailUnitRate: Number(line.rate) || 0,
        detailDiscount: Number(line.discount) || 0
      }))
    };

    const isUpdating = Boolean(invoice.invoiceId);
    const variables = isUpdating ? { id: invoice.invoiceId, input } : { input };
    const mutate = isUpdating ? updateInvoice : createInvoice;
    const { data } = await mutate({ variables });

    const payload = isUpdating ? data?.updateSalesInvoice : data?.createSalesInvoice;
    const number = payload?.invoiceNumber || payload?.id;
    const id = payload?.id;
    if (number) dispatch({ type: 'setInvoiceNumber', invoiceNumber: number });
    if (id) dispatch({ type: 'setInvoiceId', invoiceId: id });
    saveDefaultInvoiceLocationIds(branchId, warehouseId);
    saveDefaultInvoiceCurrencyId(currencyId);
    setStatus(
      isUpdating
        ? t('invoiceForm.statusUpdated', { number: number || '' })
        : t('invoiceForm.statusSaved', { number: number || '' })
    );

    if (id) {
      navigate(`/invoices/${encodeURIComponent(String(id))}`, { replace: true });
    }
  };

  const handleShareLink = async () => {
    if (!invoice.invoiceId) {
      setStatus(t('invoiceForm.shareBeforeSave'));
      return;
    }

    setStatus('');
    try {
      const share = await createInvoiceShareToken(invoice.invoiceId);
      const shareUrl = buildInvoiceShareUrl(share?.token);
      if (!shareUrl) {
        throw new Error(t('invoiceForm.shareUnavailable'));
      }

      if (navigator.share) {
        await navigator.share({ url: shareUrl, title: t('invoiceForm.shareTitle') });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }

      setStatus(t('invoiceForm.shareReady'));
    } catch (err) {
      setStatus(err.message || t('invoiceForm.shareFailed'));
    }
  };

  const canOpenStep = (targetStep) => {
    if (targetStep <= step) return true;
    if (targetStep === 1) return validateCustomer();
    if (targetStep === 2) return validateCustomer() && validateLines();
    return false;
  };

  const handleStepChange = (targetStep) => {
    if (canOpenStep(targetStep)) {
      setStep(targetStep);
    }
  };

  const handlePrimaryAction = async () => {
    if (step === 0) {
      if (validateCustomer()) setStep(1);
      return;
    }

    if (step === 1) {
      if (validateLines()) setStep(2);
      return;
    }

    if (!reviewReady) {
      if (!hasCustomer) {
        setStep(0);
        setStatus(t('invoiceForm.selectCustomerBeforeSaving'));
        return;
      }
      if (!linesReady) {
        setStep(1);
        setStatus(t('invoiceForm.addLineBeforeSaving'));
        return;
      }
      openLocationSettings();
      setStatus(t('invoiceForm.setDefaultsBeforeSaving'));
      return;
    }

    await handleSave();
  };

  const primaryLabel =
    step === 0
      ? t('invoiceForm.continueToItems')
      : step === 1
        ? t('invoiceForm.continueToReview')
        : saving
          ? t('invoiceForm.saving')
          : reviewReady
            ? t('invoiceForm.saveInvoice')
            : !defaultsReady
              ? t('invoiceForm.setDefaultsAction')
              : t('invoiceForm.completeRequiredInfo');

  const canShare = step === 2 && Boolean(invoice.invoiceId);

  const secondaryButton = canShare
    ? {
        label: t('invoiceForm.shareLink'),
        action: handleShareLink,
        style: 'btn btn-secondary'
      }
    : {
        label: step === 0 ? t('invoiceForm.cancel') : t('invoiceForm.back'),
        action: step === 0 ? () => navigate('/') : () => setStep(step - 1),
        style: 'btn btn-secondary'
      };

  const saveErrorMessage = useMemo(() => {
    const raw = getNetworkErrorMessage(saveError) || saveError?.message || '';
    const lowered = raw.toLowerCase();

    if (lowered.includes('branch not found') || lowered.includes('warehouse not found')) {
      return t('invoiceForm.branchWarehouseNotFound');
    }
    if (lowered.includes('currency not found')) {
      return t('invoiceForm.currencyNotFound');
    }
    return raw;
  }, [saveError, t]);

  const hasLocationNotFoundError = useMemo(() => {
    const raw = getNetworkErrorMessage(saveError) || saveError?.message || '';
    const lowered = raw.toLowerCase();
    return (
      lowered.includes('branch not found') ||
      lowered.includes('warehouse not found') ||
      lowered.includes('currency not found')
    );
  }, [saveError]);

  useEffect(() => {
    if (saveError && hasLocationNotFoundError && !isLocationOpen) {
      openLocationSettings();
    }
  }, [hasLocationNotFoundError, isLocationOpen, saveError]);

  const stepGuide = useMemo(() => {
    if (step === 0) {
      return hasCustomer
        ? t('invoiceForm.customerSelectedHint')
        : t('invoiceForm.chooseCustomerAndVerifyDefaults');
    }
    if (step === 1) {
      return linesReady ? t('invoiceForm.itemsReadyHint') : t('invoiceForm.addCompleteLineHint');
    }
    return t('invoiceForm.reviewTotalsHint');
  }, [hasCustomer, linesReady, step, t]);

  useEffect(() => {
    if (!isPreviewOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPreviewOpen]);

  return (
    <div className="invoice-page">
      <section className="flow-banner">
        <p className="kicker">{t('invoiceForm.bannerKicker')}</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          {t('invoiceForm.bannerTitle')}
        </h2>
        <p className="subtle">{t('invoiceForm.bannerCopy')}</p>

        <div className="stepper" role="tablist" aria-label={t('invoiceForm.stepperAria')}>
          {flowSteps.map((flowStep, index) => {
            const isCurrent = step === index;
            const isComplete = index === 0 ? hasCustomer : index === 1 ? linesReady : Boolean(invoice.invoiceId);
            const className = `step ${isCurrent ? 'step-current' : ''} ${isComplete ? 'step-complete' : ''}`.trim();

            return (
              <button
                key={flowStep.key}
                type="button"
                className={className}
                onClick={() => handleStepChange(index)}
                role="tab"
                aria-selected={isCurrent}
                aria-controls={`invoice-step-${flowStep.key}`}
              >
                <span className="step-index">{t('invoiceForm.stepIndex', { number: index + 1 })}</span>
                <span className="step-label">{t(flowStep.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <div className="flow-health" role="status" aria-live="polite">
          <div className="flow-health-grid">
            <span className={`health-chip ${hasCustomer ? 'ok' : ''}`}>{t('invoiceForm.healthCustomer')}</span>
            <span className={`health-chip ${linesReady ? 'ok' : ''}`}>{t('invoiceForm.healthItems')}</span>
            <span className={`health-chip ${defaultsReady ? 'ok' : ''}`}>{t('invoiceForm.healthDefaults')}</span>
          </div>
          <p className="subtle" style={{ marginTop: 8 }}>{stepGuide}</p>
        </div>
      </section>

      {step === 0 && (
        <section className="invoice-panel" id="invoice-step-customer">
          <div className="invoice-header">
            <div>
              <div className="invoice-label">{t('invoiceForm.invoiceNo')}</div>
              <div className="invoice-number">{invoice.invoiceNumber || t('invoiceForm.newLabel')}</div>
            </div>
            <span className={`badge ${invoice.invoiceId ? 'badge-success' : 'badge-neutral'}`}>
              {invoice.invoiceId ? t('invoiceForm.saved') : t('invoiceForm.draft')}
            </span>
          </div>

          <div className="invoice-meta-grid">
            <label className="field">
              <span className="label">{t('invoiceForm.date')}</span>
              <input
                className="input"
                type="date"
                value={invoice.invoiceDate}
                onChange={(event) => dispatch({ type: 'setField', field: 'invoiceDate', value: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="label">{t('invoiceForm.paymentTermsLabel')}</span>
              <select
                className="input"
                value={invoice.paymentTerms}
                onChange={(event) => dispatch({ type: 'setField', field: 'paymentTerms', value: event.target.value })}
              >
                {paymentTermsOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="default-location-row" role="status" aria-live="polite">
            <span className="meta-chip">
              {t('invoiceForm.defaultsBranch')}: {selectedBranchName || t('invoiceForm.notSet')}
            </span>
            <span className="meta-chip">
              {t('invoiceForm.defaultsWarehouse')}: {selectedWarehouseName || t('invoiceForm.notSet')}
            </span>
            <span className="meta-chip">
              {t('invoiceForm.defaultsCurrency')}: {selectedCurrencyLabel}
            </span>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={openLocationSettings}
              style={{ minHeight: 36, padding: '8px 12px' }}
            >
              {t('invoiceForm.change')}
            </button>
          </div>

          <button type="button" className="row-button" onClick={openCustomerPicker}>
            <div className="row-label">{t('invoiceForm.to')}</div>
            <div className={`row-value ${invoice.customerName ? '' : 'row-placeholder'}`}>
              {invoice.customerName || t('invoiceForm.selectCustomer')}
            </div>
            <div className="row-chevron" aria-hidden="true">
              {'>'}
            </div>
          </button>

          {errors.customer && <div className="inline-error">{errors.customer}</div>}
        </section>
      )}

      {step === 1 && (
        <section className="invoice-panel" id="invoice-step-items">
          <div className="section-title-row">
            <div>
              <h3 className="section-title" style={{ margin: 0 }}>
                {t('invoiceForm.addInvoiceItems')}
              </h3>
              <p className="section-hint">{t('invoiceForm.lineHint')}</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={addLineAndPick}>
              {t('invoiceForm.addItem')}
            </button>
          </div>

          <div className="line-list">
            {invoice.lines.map((line) => (
              <InvoiceLineCard
                key={line.id}
                line={line}
                showError={errors.lines.includes(line.id)}
                onSelectItem={() => openItemPicker(line.id)}
                onChangeQty={(value) => dispatch({ type: 'updateLine', lineId: line.id, field: 'qty', value })}
                onChangeRate={(value) => dispatch({ type: 'updateLine', lineId: line.id, field: 'rate', value })}
                onChangeDiscount={(value) =>
                  dispatch({ type: 'updateLine', lineId: line.id, field: 'discount', value })
                }
                onToggleTaxable={(value) =>
                  dispatch({ type: 'updateLine', lineId: line.id, field: 'taxable', value })
                }
                onRemove={() => dispatch({ type: 'removeLine', lineId: line.id })}
              />
            ))}
          </div>

          {errors.lines.includes('__empty__') && <div className="inline-error">{t('invoiceForm.addLineRequired')}</div>}
        </section>
      )}

      {step === 2 && (
        <section className="invoice-panel" id="invoice-step-review">
          <h3 className="section-title" style={{ margin: 0 }}>
            {t('invoiceForm.reviewTitle')}
          </h3>
          <p className="section-hint">{t('invoiceForm.reviewHint')}</p>

          <section className="readiness-card" role="status" aria-live="polite">
            <div className="readiness-grid">
              <div className={`readiness-item ${hasCustomer ? 'ok' : ''}`}>{t('invoiceForm.healthCustomer')}</div>
              <div className={`readiness-item ${linesReady ? 'ok' : ''}`}>{t('invoiceForm.healthItems')}</div>
              <div className={`readiness-item ${defaultsReady ? 'ok' : ''}`}>{t('invoiceForm.healthDefaults')}</div>
            </div>
            {!reviewReady && (
              <div className="readiness-actions">
                {!hasCustomer && (
                  <button className="btn btn-secondary" type="button" onClick={() => setStep(0)}>
                    {t('invoiceForm.fixCustomer')}
                  </button>
                )}
                {hasCustomer && !linesReady && (
                  <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>
                    {t('invoiceForm.fixItems')}
                  </button>
                )}
                {!defaultsReady && (
                  <button className="btn btn-secondary" type="button" onClick={openLocationSettings}>
                    {t('invoiceForm.setDefaults')}
                  </button>
                )}
              </div>
            )}
          </section>

          <label className="field">
            <span className="label">{t('invoiceForm.notes')}</span>
            <textarea
              className="input"
              rows="3"
              value={invoice.notes}
              onChange={(event) => dispatch({ type: 'setField', field: 'notes', value: event.target.value })}
              placeholder={t('invoiceForm.notesPlaceholder')}
            />
          </label>

          <div className="summary-card">
            <div className="summary-row">
              <span>{t('invoiceForm.subtotal')}</span>
              <span>{currency(totals.subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>{t('invoiceForm.discount')}</span>
              <span>-{currency(totals.discount)}</span>
            </div>
            <div className="summary-row">
              <span>{t('invoiceForm.tax')}</span>
              <span>{currency(totals.tax)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>{t('invoiceForm.total')}</span>
              <span>{currency(totals.total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="preview-chip"
            onClick={() => setIsPreviewOpen(true)}
            aria-expanded={isPreviewOpen}
          >
            {t('invoiceForm.previewInvoice', { amount: currency(totals.total) })}
          </button>

          <div className="surface-card flow-note-card">
            <p className="kicker">{t('invoiceForm.nextAfterSave')}</p>
            <p className="subtle">
              {t('invoiceForm.nextAfterSaveCopy')}
            </p>
          </div>
        </section>
      )}

      {(status || saveError) && (
        <section className={saveError ? 'state-error' : 'surface-card'} role="status" aria-live="polite">
          {saveError ? (
            <>
              <p className="state-title">{t('invoiceForm.couldNotSaveTitle')}</p>
              <p className="state-message">{saveErrorMessage}</p>
            </>
          ) : (
            <>
              <p className="state-title">{t('invoiceForm.updateTitle')}</p>
              <p className="state-message">{status}</p>
            </>
          )}
          {saveError && hasLocationNotFoundError && (
            <div className="state-actions">
              <button className="btn btn-secondary" type="button" onClick={openLocationSettings}>
                {t('invoiceForm.setInvoiceDefaults')}
              </button>
            </div>
          )}
        </section>
      )}

      {isLocationOpen && (
        <Modal title={t('invoiceForm.defaultsModalTitle')} onClose={() => setIsLocationOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              {t('invoiceForm.defaultsModalCopy')}
            </p>

            {locationsLoading && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">{t('invoiceForm.loadingLocations')}</p>
              </section>
            )}
            {locationsError && (
              <section className="state-error" role="alert">
                <p className="state-title">{t('invoiceForm.locationsLoadFailTitle')}</p>
                <p className="state-message">{t('invoiceForm.locationsLoadFailCopy')}</p>
              </section>
            )}

            {businessLoading && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">{t('invoiceForm.loadingCurrency')}</p>
              </section>
            )}
            {businessError && (
              <section className="state-error" role="alert">
                <p className="state-title">{t('invoiceForm.currencyLoadFailTitle')}</p>
                <p className="state-message">{t('invoiceForm.currencyLoadFailCopy')}</p>
              </section>
            )}

            <label className="field">
              <span className="label">{t('invoiceForm.branch')}</span>
              {branches.length > 0 ? (
                <select
                  className="input"
                  value={branchIdInput}
                  onChange={(event) => setBranchIdInput(event.target.value)}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name ? `${branch.name} (#${branch.id})` : `#${branch.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={branchIdInput}
                  onChange={(event) => setBranchIdInput(event.target.value)}
                  placeholder={t('invoiceForm.branchIdPlaceholder')}
                />
              )}
            </label>

            <label className="field">
              <span className="label">{t('invoiceForm.warehouse')}</span>
              {warehouses.length > 0 ? (
                <select
                  className="input"
                  value={warehouseIdInput}
                  onChange={(event) => setWarehouseIdInput(event.target.value)}
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name ? `${warehouse.name} (#${warehouse.id})` : `#${warehouse.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={warehouseIdInput}
                  onChange={(event) => setWarehouseIdInput(event.target.value)}
                  placeholder={t('invoiceForm.warehouseIdPlaceholder')}
                />
              )}
            </label>

            <label className="field">
              <span className="label">{t('invoiceForm.currency')}</span>
              {baseCurrencyId ? (
                <select
                  className="input"
                  value={currencyIdInput}
                  onChange={(event) => setCurrencyIdInput(event.target.value)}
                >
                  <option value={baseCurrencyId}>
                    {baseCurrency?.name
                      ? `${baseCurrency.name}${baseCurrency.symbol ? ` (${baseCurrency.symbol})` : ''} (#${baseCurrencyId})`
                      : `#${baseCurrencyId}`}
                  </option>
                </select>
              ) : (
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={currencyIdInput}
                  onChange={(event) => setCurrencyIdInput(event.target.value)}
                  placeholder={t('invoiceForm.currencyIdPlaceholder')}
                />
              )}
            </label>

            {locationInputError && <div className="inline-error">{locationInputError}</div>}

            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsLocationOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" type="button" onClick={saveLocationSettings}>
                {t('invoiceForm.saveDefaults')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className={`sheet-backdrop ${isPreviewOpen ? 'open' : ''}`} onClick={() => setIsPreviewOpen(false)} />
      <section
        className={`sheet ${isPreviewOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('invoiceForm.invoicePreviewAria')}
        aria-hidden={!isPreviewOpen}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <h3 className="title" style={{ margin: 0 }}>
            {t('invoiceForm.invoicePreviewTitle')}
          </h3>
          <button className="btn btn-secondary" type="button" onClick={() => setIsPreviewOpen(false)}>
            {t('common.close')}
          </button>
        </div>
        <InvoicePreview invoice={invoice} />
      </section>

      <div className="sticky-actions">
        <button className={secondaryButton.style} type="button" onClick={secondaryButton.action}>
          {secondaryButton.label}
        </button>
        <button className="btn btn-primary" type="button" onClick={handlePrimaryAction} disabled={saving}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

export default InvoiceForm;
