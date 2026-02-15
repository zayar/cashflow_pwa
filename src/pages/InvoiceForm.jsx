import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import InvoicePreview from '../components/InvoicePreview';
import InvoiceLineCard from '../components/InvoiceLineCard';
import Modal from '../components/Modal';
import { createLine, useInvoiceDraft } from '../state/invoiceDraft';
import { saveDefaultInvoiceCurrencyId, saveDefaultInvoiceLocationIds, getDefaultInvoiceLocationIds, getDefaultInvoiceCurrencyId } from '../lib/auth';
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
      isPrimary
      isDefault
    }
    listAllWarehouse {
      id
      name
      isPrimary
      isDefault
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

function pickPreferredId(options, preferredId) {
  if (!Array.isArray(options) || options.length === 0) return 0;
  const preferred = toPositiveInt(preferredId);
  if (preferred) {
    const match = options.find((item) => toPositiveInt(item?.id) === preferred);
    if (match) return toPositiveInt(match.id);
  }
  const primary = options.find((item) => item?.isPrimary || item?.isDefault);
  if (primary) return toPositiveInt(primary.id);
  return toPositiveInt(options[0]?.id);
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
  const { lang, t } = useI18n();
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
  const [isDateEditorOpen, setIsDateEditorOpen] = useState(false);
  const [isTermsEditorOpen, setIsTermsEditorOpen] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(() => Boolean((invoice.notes || '').trim()));

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

  const businessId = toPositiveInt(businessData?.getBusiness?.id);
  const baseCurrency = businessData?.getBusiness?.baseCurrency;
  const baseCurrencyId = toPositiveInt(baseCurrency?.id);
  const branches = locationData?.listAllBranch ?? [];
  const warehouses = locationData?.listAllWarehouse ?? [];
  const storedLocationDefaults = useMemo(() => getDefaultInvoiceLocationIds(businessId), [businessId]);
  const storedCurrencyDefault = useMemo(() => getDefaultInvoiceCurrencyId(businessId), [businessId]);

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

  const selectedPaymentTermsLabel = useMemo(() => {
    const selected = paymentTermsOptions.find((option) => option.value === invoice.paymentTerms);
    if (!selected) return invoice.paymentTerms || t('invoiceForm.notSet');
    return t(selected.labelKey);
  }, [invoice.paymentTerms, t]);

  const formattedInvoiceDate = useMemo(() => {
    if (!invoice.invoiceDate) return t('invoiceForm.notSet');
    const parsed = new Date(`${invoice.invoiceDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return invoice.invoiceDate;
    return parsed.toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [invoice.invoiceDate, lang, t]);

  const itemCountLabel = useMemo(() => {
    const count = invoice.lines.length;
    if (count <= 0) return t('invoiceForm.notSet');
    return count === 1 ? '1 item' : `${count} items`;
  }, [invoice.lines.length, t]);

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
    const desiredCurrencyId =
      currentCurrencyId && currentCurrencyId === baseCurrencyId
        ? currentCurrencyId
        : baseCurrencyId || toPositiveInt(storedCurrencyDefault);

    if (!desiredCurrencyId || desiredCurrencyId === currentCurrencyId) return;

    dispatch({ type: 'setField', field: 'currencyId', value: desiredCurrencyId });
    saveDefaultInvoiceCurrencyId(desiredCurrencyId, businessId);
    if (isLocationOpen) setCurrencyIdInput(String(desiredCurrencyId));
  }, [baseCurrencyId, businessId, dispatch, invoice.currencyId, storedCurrencyDefault, isLocationOpen]);

  useEffect(() => {
    if (locationsLoading) return;
    if (!branches.length || !warehouses.length) return;

    const nextBranchId = pickPreferredId(branches, storedLocationDefaults.branchId);
    const nextWarehouseId = pickPreferredId(warehouses, storedLocationDefaults.warehouseId);
    const branchInvalid = !selectedBranchId || !branches.some((branch) => toPositiveInt(branch.id) === selectedBranchId);
    const warehouseInvalid =
      !selectedWarehouseId || !warehouses.some((warehouse) => toPositiveInt(warehouse.id) === selectedWarehouseId);

    if (branchInvalid || selectedBranchId !== nextBranchId) {
      dispatch({ type: 'setField', field: 'branchId', value: nextBranchId });
      saveDefaultInvoiceLocationIds(nextBranchId, selectedWarehouseId || nextWarehouseId, businessId);
      if (isLocationOpen) setBranchIdInput(String(nextBranchId));
    }

    if (warehouseInvalid || selectedWarehouseId !== nextWarehouseId) {
      dispatch({ type: 'setField', field: 'warehouseId', value: nextWarehouseId });
      saveDefaultInvoiceLocationIds(selectedBranchId || nextBranchId, nextWarehouseId, businessId);
      if (isLocationOpen) setWarehouseIdInput(String(nextWarehouseId));
    }
  }, [
    branches,
    warehouses,
    locationsLoading,
    selectedBranchId,
    selectedWarehouseId,
    storedLocationDefaults.branchId,
    storedLocationDefaults.warehouseId,
    dispatch,
    businessId,
    isLocationOpen
  ]);

  useEffect(() => {
    if (!isLocationOpen) return;

    const branchIds = new Set(branches.map((branch) => String(branch.id)));
    const warehouseIds = new Set(warehouses.map((warehouse) => String(warehouse.id)));

    const primaryBranch = branches.find((branch) => branch?.isPrimary || branch?.isDefault);
    const primaryWarehouse = warehouses.find((warehouse) => warehouse?.isPrimary || warehouse?.isDefault);

    if (branches.length > 0 && (!branchIdInput || !branchIds.has(String(branchIdInput)))) {
      setBranchIdInput(String(primaryBranch?.id ?? branches[0]?.id ?? ''));
    }

    if (warehouses.length > 0 && (!warehouseIdInput || !warehouseIds.has(String(warehouseIdInput)))) {
      setWarehouseIdInput(String(primaryWarehouse?.id ?? warehouses[0]?.id ?? ''));
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
    saveDefaultInvoiceLocationIds(nextBranchId, nextWarehouseId, businessId);
    saveDefaultInvoiceCurrencyId(nextCurrencyId, businessId);
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

  const secondaryButton = {
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

  useEffect(() => {
    if ((invoice.notes || '').trim()) {
      setIsNoteExpanded(true);
    }
  }, [invoice.notes]);

  useEffect(() => {
    if (step === 2) return;
    setIsDateEditorOpen(false);
    setIsTermsEditorOpen(false);
  }, [step]);

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
      <section className="compact-step-indicator" aria-label={t('invoiceForm.stepperAria')}>
        <span className="compact-step-current">{t('invoiceForm.stepIndex', { number: step + 1 })}</span>
        <span className="compact-step-divider" aria-hidden="true">
          /
        </span>
        <span className="compact-step-total">3</span>
      </section>

      {step === 0 && (
        <section className="invoice-panel invoice-panel-customer" id="invoice-step-customer">
          <button type="button" className="customer-select-card" onClick={openCustomerPicker}>
            <span className="customer-select-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5.5 19c1.35-3.1 3.65-4.65 6.5-4.65s5.15 1.55 6.5 4.65" />
              </svg>
            </span>
            <div className="customer-select-copy">
              <span className="customer-select-label">{t('invoiceForm.selectCustomer')}</span>
              <span className={`customer-select-value ${invoice.customerName ? '' : 'customer-select-placeholder'}`}>
                {invoice.customerName || t('invoiceForm.notSet')}
              </span>
            </div>
            <span className="customer-select-arrow" aria-hidden="true">
              {'>'}
            </span>
          </button>

          {errors.customer && <div className="inline-error">{errors.customer}</div>}

          <section className="location-settings-card" role="status" aria-live="polite">
            <div className="location-settings-grid">
              <div className="location-settings-item">
                <span className="location-settings-label">{t('invoiceForm.branch')}</span>
                <span className="location-settings-value">{selectedBranchName || t('invoiceForm.notSet')}</span>
              </div>
              <div className="location-settings-item">
                <span className="location-settings-label">{t('invoiceForm.warehouse')}</span>
                <span className="location-settings-value">{selectedWarehouseName || t('invoiceForm.notSet')}</span>
              </div>
              <div className="location-settings-item">
                <span className="location-settings-label">{t('invoiceForm.currency')}</span>
                <span className="location-settings-value">{selectedCurrencyLabel}</span>
              </div>
            </div>
            <button className="btn btn-ghost location-settings-action" type="button" onClick={openLocationSettings}>
              {t('invoiceForm.change')}
            </button>
          </section>
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
        <section className="invoice-panel invoice-panel-review" id="invoice-step-review">
          <h3 className="section-title" style={{ margin: 0 }}>
            {t('invoiceForm.reviewTitle')}
          </h3>

          <section className="review-summary-card" role="status" aria-live="polite">
            <div className="review-summary-row">
              <div className="review-summary-main">
                <span className="review-summary-label">{t('invoiceForm.healthCustomer')}</span>
                <span className={`review-summary-value ${hasCustomer ? '' : 'review-summary-placeholder'}`}>
                  {invoice.customerName || t('invoiceForm.notSet')}
                </span>
              </div>
              <button className="review-link-btn" type="button" onClick={() => setStep(0)}>
                {hasCustomer ? t('common.edit') : t('invoiceForm.fixCustomer')}
              </button>
            </div>

            <div className="review-summary-divider" />

            <div className="review-summary-row">
              <div className="review-summary-main">
                <span className="review-summary-label">{t('invoiceForm.date')}</span>
                <span className="review-summary-value">{formattedInvoiceDate}</span>
              </div>
              <button
                className="review-link-btn"
                type="button"
                onClick={() => setIsDateEditorOpen((previous) => !previous)}
                aria-expanded={isDateEditorOpen}
              >
                {isDateEditorOpen ? t('common.close') : t('common.edit')}
              </button>
            </div>

            {isDateEditorOpen && (
              <div className="review-inline-editor">
                <input
                  className="input"
                  type="date"
                  value={invoice.invoiceDate}
                  onChange={(event) => dispatch({ type: 'setField', field: 'invoiceDate', value: event.target.value })}
                />
              </div>
            )}

            <div className="review-summary-row">
              <div className="review-summary-main">
                <span className="review-summary-label">{t('invoiceForm.paymentTermsLabel')}</span>
                <span className="review-summary-value">{selectedPaymentTermsLabel}</span>
              </div>
              <button
                className="review-link-btn"
                type="button"
                onClick={() => setIsTermsEditorOpen((previous) => !previous)}
                aria-expanded={isTermsEditorOpen}
              >
                {isTermsEditorOpen ? t('common.close') : t('common.edit')}
              </button>
            </div>

            {isTermsEditorOpen && (
              <div className="review-inline-editor">
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
              </div>
            )}
          </section>

          <section className="review-support-grid" role="status" aria-live="polite">
            <div className="review-support-card">
              <div className="review-summary-main">
                <span className="review-summary-label">{t('invoiceForm.healthItems')}</span>
                <span className={`review-summary-value ${linesReady ? '' : 'review-summary-placeholder'}`}>
                  {itemCountLabel}
                </span>
              </div>
              <button className="review-link-btn" type="button" onClick={() => setStep(1)}>
                {t('invoiceForm.fixItems')}
              </button>
            </div>

            <div className="review-support-card">
              <div className="review-summary-main">
                <span className="review-summary-label">{t('invoiceForm.healthDefaults')}</span>
                <span className={`review-summary-value ${defaultsReady ? '' : 'review-summary-placeholder'}`}>
                  {selectedBranchName || t('invoiceForm.notSet')} - {selectedWarehouseName || t('invoiceForm.notSet')}
                </span>
                <span className="review-summary-subvalue">{selectedCurrencyLabel}</span>
              </div>
              <button className="review-link-btn" type="button" onClick={openLocationSettings}>
                {t('invoiceForm.setDefaults')}
              </button>
            </div>
          </section>

          <div className="summary-card totals-hero-card">
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

          <section className="note-collapsible-card">
            {!isNoteExpanded ? (
              <button className="note-expand-button" type="button" onClick={() => setIsNoteExpanded(true)}>
                + Add note
              </button>
            ) : (
              <label className="field" style={{ margin: 0 }}>
                <div className="note-editor-header">
                  <span className="label" style={{ margin: 0 }}>
                    {t('invoiceForm.notes')}
                  </span>
                  {!((invoice.notes || '').trim()) && (
                    <button className="review-link-btn" type="button" onClick={() => setIsNoteExpanded(false)}>
                      {t('common.close')}
                    </button>
                  )}
                </div>
                <textarea
                  className="input note-editor-input"
                  rows="3"
                  value={invoice.notes}
                  onChange={(event) => dispatch({ type: 'setField', field: 'notes', value: event.target.value })}
                  placeholder={t('invoiceForm.notesPlaceholder')}
                />
              </label>
            )}
          </section>

          <button
            type="button"
            className="preview-chip"
            onClick={() => setIsPreviewOpen(true)}
            aria-expanded={isPreviewOpen}
          >
            {t('invoiceForm.previewInvoice', { amount: currency(totals.total) })}
          </button>
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
        {step === 2 && (invoice.currentStatus || 'Draft') === 'Draft' && (
          <p className="sticky-actions-hint">Invoice will be saved as Draft</p>
        )}
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
