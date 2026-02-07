import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation, useQuery } from '@apollo/client';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import InvoicePreview from '../components/InvoicePreview';
import InvoiceLineCard from '../components/InvoiceLineCard';
import Modal from '../components/Modal';
import { createLine, useInvoiceDraft } from '../state/invoiceDraft';
import { buildInvoiceShareUrl, createInvoiceShareToken } from '../lib/shareApi';
import { saveDefaultInvoiceCurrencyId, saveDefaultInvoiceLocationIds } from '../lib/auth';

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
  { value: 'DueOnReceipt', label: 'Due on receipt' },
  { value: 'Net7', label: 'Net 7' },
  { value: 'Net15', label: 'Net 15' },
  { value: 'Net30', label: 'Net 30' }
];

const flowSteps = [
  { key: 'customer', label: 'Customer' },
  { key: 'items', label: 'Items' },
  { key: 'review', label: 'Review' }
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
    return selected?.name || `Branch #${selectedBranchId}`;
  }, [branches, selectedBranchId]);

  const selectedWarehouseName = useMemo(() => {
    if (!selectedWarehouseId) return '';
    const selected = warehouses.find((warehouse) => toPositiveInt(warehouse.id) === selectedWarehouseId);
    return selected?.name || `Warehouse #${selectedWarehouseId}`;
  }, [selectedWarehouseId, warehouses]);

  const selectedCurrencyLabel = useMemo(() => {
    if (!selectedCurrencyId) return 'Currency not set';
    if (baseCurrency?.name && (!baseCurrencyId || selectedCurrencyId === baseCurrencyId)) {
      return `${baseCurrency.name}${baseCurrency.symbol ? ` (${baseCurrency.symbol})` : ''}`;
    }
    return `Currency #${selectedCurrencyId}`;
  }, [baseCurrency?.name, baseCurrency?.symbol, baseCurrencyId, selectedCurrencyId]);

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
      setLocationInputError('Please enter a valid branch, warehouse, and currency.');
      return;
    }

    dispatch({ type: 'setField', field: 'branchId', value: nextBranchId });
    dispatch({ type: 'setField', field: 'warehouseId', value: nextWarehouseId });
    dispatch({ type: 'setField', field: 'currencyId', value: nextCurrencyId });
    saveDefaultInvoiceLocationIds(nextBranchId, nextWarehouseId);
    saveDefaultInvoiceCurrencyId(nextCurrencyId);
    setStatus('Invoice defaults updated.');
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
    const customerError = hasCustomer ? '' : 'Please choose a customer before continuing.';
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
      setStatus('Choose invoice defaults (branch, warehouse, currency) to save invoices.');
      openLocationSettings();
      return;
    }

    if (!hasValidBranchSelection || !hasValidWarehouseSelection || !hasValidCurrencySelection) {
      setStatus('Selected defaults are no longer valid. Please choose branch, warehouse, and currency again.');
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
    setStatus(isUpdating ? `Invoice ${number || ''} updated.`.trim() : `Invoice ${number || ''} saved.`.trim());

    if (id) {
      navigate(`/invoices/${encodeURIComponent(String(id))}`, { replace: true });
    }
  };

  const handleShareLink = async () => {
    if (!invoice.invoiceId) {
      setStatus('Save the invoice before sharing.');
      return;
    }

    setStatus('');
    try {
      const share = await createInvoiceShareToken(invoice.invoiceId);
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
    } catch (err) {
      setStatus(err.message || 'Failed to generate share link.');
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
        setStatus('Select a customer before saving.');
        return;
      }
      if (!linesReady) {
        setStep(1);
        setStatus('Add at least one complete line item before saving.');
        return;
      }
      openLocationSettings();
      setStatus('Set branch, warehouse, and currency defaults before saving.');
      return;
    }

    await handleSave();
  };

  const primaryLabel =
    step === 0
      ? 'Continue to items'
      : step === 1
        ? 'Continue to review'
        : saving
          ? 'Saving...'
          : reviewReady
            ? 'Save invoice'
            : !defaultsReady
              ? 'Set defaults'
              : 'Complete required info';

  const canShare = step === 2 && Boolean(invoice.invoiceId);

  const secondaryButton = canShare
    ? {
        label: 'Share link',
        action: handleShareLink,
        style: 'btn btn-secondary'
      }
    : {
        label: step === 0 ? 'Cancel' : 'Back',
        action: step === 0 ? () => navigate('/') : () => setStep(step - 1),
        style: 'btn btn-secondary'
      };

  const saveErrorMessage = useMemo(() => {
    const raw = getNetworkErrorMessage(saveError) || saveError?.message || '';
    const lowered = raw.toLowerCase();

    if (lowered.includes('branch not found') || lowered.includes('warehouse not found')) {
      return 'We could not find the selected branch/warehouse. Please choose valid defaults.';
    }
    if (lowered.includes('currency not found')) {
      return 'We could not find the selected currency. Please choose a valid default currency.';
    }
    return raw;
  }, [saveError]);

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
        ? 'Customer selected. Continue to items when ready.'
        : 'Choose customer and verify branch, warehouse, and currency.';
    }
    if (step === 1) {
      return linesReady ? 'Items ready. Continue to review and save.' : 'Add at least one complete line item.';
    }
    return 'Review totals, add optional note, then save invoice.';
  }, [hasCustomer, linesReady, step]);

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
        <p className="kicker">Beginner flow</p>
        <h2 className="title" style={{ marginBottom: 6 }}>
          Create an invoice in under a minute
        </h2>
        <p className="subtle">Follow the steps: choose customer, add items, then review and save.</p>

        <div className="stepper" role="tablist" aria-label="Invoice creation steps">
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
                <span className="step-index">Step {index + 1}</span>
                <span className="step-label">{flowStep.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flow-health" role="status" aria-live="polite">
          <div className="flow-health-grid">
            <span className={`health-chip ${hasCustomer ? 'ok' : ''}`}>Customer</span>
            <span className={`health-chip ${linesReady ? 'ok' : ''}`}>Items</span>
            <span className={`health-chip ${defaultsReady ? 'ok' : ''}`}>Defaults</span>
          </div>
          <p className="subtle" style={{ marginTop: 8 }}>{stepGuide}</p>
        </div>
      </section>

      {step === 0 && (
        <section className="invoice-panel" id="invoice-step-customer">
          <div className="invoice-header">
            <div>
              <div className="invoice-label">Invoice No</div>
              <div className="invoice-number">{invoice.invoiceNumber || 'New'}</div>
            </div>
            <span className={`badge ${invoice.invoiceId ? 'badge-success' : 'badge-neutral'}`}>
              {invoice.invoiceId ? 'Saved' : 'Draft'}
            </span>
          </div>

          <div className="invoice-meta-grid">
            <label className="field">
              <span className="label">Date</span>
              <input
                className="input"
                type="date"
                value={invoice.invoiceDate}
                onChange={(event) => dispatch({ type: 'setField', field: 'invoiceDate', value: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="label">Payment terms</span>
              <select
                className="input"
                value={invoice.paymentTerms}
                onChange={(event) => dispatch({ type: 'setField', field: 'paymentTerms', value: event.target.value })}
              >
                {paymentTermsOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="default-location-row" role="status" aria-live="polite">
            <span className="meta-chip">
              Branch: {selectedBranchName || 'Not set'}
            </span>
            <span className="meta-chip">
              Warehouse: {selectedWarehouseName || 'Not set'}
            </span>
            <span className="meta-chip">
              Currency: {selectedCurrencyLabel}
            </span>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={openLocationSettings}
              style={{ minHeight: 36, padding: '8px 12px' }}
            >
              Change
            </button>
          </div>

          <button type="button" className="row-button" onClick={openCustomerPicker}>
            <div className="row-label">To</div>
            <div className={`row-value ${invoice.customerName ? '' : 'row-placeholder'}`}>
              {invoice.customerName || 'Select customer'}
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
                Add invoice items
              </h3>
              <p className="section-hint">Each line needs an item before you continue.</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={addLineAndPick}>
              + Add item
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

          {errors.lines.includes('__empty__') && <div className="inline-error">Add at least one line item.</div>}
        </section>
      )}

      {step === 2 && (
        <section className="invoice-panel" id="invoice-step-review">
          <h3 className="section-title" style={{ margin: 0 }}>
            Review and finish
          </h3>
          <p className="section-hint">Confirm totals and add an optional note before saving.</p>

          <section className="readiness-card" role="status" aria-live="polite">
            <div className="readiness-grid">
              <div className={`readiness-item ${hasCustomer ? 'ok' : ''}`}>Customer</div>
              <div className={`readiness-item ${linesReady ? 'ok' : ''}`}>Items</div>
              <div className={`readiness-item ${defaultsReady ? 'ok' : ''}`}>Defaults</div>
            </div>
            {!reviewReady && (
              <div className="readiness-actions">
                {!hasCustomer && (
                  <button className="btn btn-secondary" type="button" onClick={() => setStep(0)}>
                    Fix customer
                  </button>
                )}
                {hasCustomer && !linesReady && (
                  <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>
                    Fix items
                  </button>
                )}
                {!defaultsReady && (
                  <button className="btn btn-secondary" type="button" onClick={openLocationSettings}>
                    Set defaults
                  </button>
                )}
              </div>
            )}
          </section>

          <label className="field">
            <span className="label">Notes</span>
            <textarea
              className="input"
              rows="3"
              value={invoice.notes}
              onChange={(event) => dispatch({ type: 'setField', field: 'notes', value: event.target.value })}
              placeholder="Add a note for your customer"
            />
          </label>

          <div className="summary-card">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{currency(totals.subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Discount</span>
              <span>-{currency(totals.discount)}</span>
            </div>
            <div className="summary-row">
              <span>Tax</span>
              <span>{currency(totals.tax)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>Total</span>
              <span>{currency(totals.total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="preview-chip"
            onClick={() => setIsPreviewOpen(true)}
            aria-expanded={isPreviewOpen}
          >
            Preview invoice {currency(totals.total)}
          </button>

          <div className="surface-card flow-note-card">
            <p className="kicker">Next after save</p>
            <p className="subtle">
              Confirm the invoice from details, then use Record Payment to settle the remaining balance.
            </p>
          </div>
        </section>
      )}

      {(status || saveError) && (
        <section className={saveError ? 'state-error' : 'surface-card'} role="status" aria-live="polite">
          {saveError ? (
            <>
              <p className="state-title">Could not save invoice.</p>
              <p className="state-message">{saveErrorMessage}</p>
            </>
          ) : (
            <>
              <p className="state-title">Update</p>
              <p className="state-message">{status}</p>
            </>
          )}
          {saveError && hasLocationNotFoundError && (
            <div className="state-actions">
              <button className="btn btn-secondary" type="button" onClick={openLocationSettings}>
                Set invoice defaults
              </button>
            </div>
          )}
        </section>
      )}

      {isLocationOpen && (
        <Modal title="Invoice defaults" onClose={() => setIsLocationOpen(false)}>
          <div className="form-grid">
            <p className="subtle" style={{ marginTop: 0 }}>
              Cashflow Lite uses your existing Branch + Warehouse + Currency. Select valid defaults so invoices can be created.
            </p>

            {locationsLoading && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">Loading branches and warehouses...</p>
              </section>
            )}
            {locationsError && (
              <section className="state-error" role="alert">
                <p className="state-title">Couldn&apos;t load locations.</p>
                <p className="state-message">Enter branch and warehouse IDs manually.</p>
              </section>
            )}

            {businessLoading && (
              <section className="state-loading" role="status" aria-live="polite">
                <p className="state-message">Loading currency...</p>
              </section>
            )}
            {businessError && (
              <section className="state-error" role="alert">
                <p className="state-title">Couldn&apos;t load currency.</p>
                <p className="state-message">Enter currency ID manually.</p>
              </section>
            )}

            <label className="field">
              <span className="label">Branch</span>
              {branches.length > 0 ? (
                <select
                  className="input"
                  value={branchIdInput}
                  onChange={(event) => setBranchIdInput(event.target.value)}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name ? `${branch.name} (#${branch.id})` : `Branch #${branch.id}`}
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
                  placeholder="Branch ID"
                />
              )}
            </label>

            <label className="field">
              <span className="label">Warehouse</span>
              {warehouses.length > 0 ? (
                <select
                  className="input"
                  value={warehouseIdInput}
                  onChange={(event) => setWarehouseIdInput(event.target.value)}
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name ? `${warehouse.name} (#${warehouse.id})` : `Warehouse #${warehouse.id}`}
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
                  placeholder="Warehouse ID"
                />
              )}
            </label>

            <label className="field">
              <span className="label">Currency</span>
              {baseCurrencyId ? (
                <select
                  className="input"
                  value={currencyIdInput}
                  onChange={(event) => setCurrencyIdInput(event.target.value)}
                >
                  <option value={baseCurrencyId}>
                    {baseCurrency?.name
                      ? `${baseCurrency.name}${baseCurrency.symbol ? ` (${baseCurrency.symbol})` : ''} (#${baseCurrencyId})`
                      : `Currency #${baseCurrencyId}`}
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
                  placeholder="Currency ID"
                />
              )}
            </label>

            {locationInputError && <div className="inline-error">{locationInputError}</div>}

            <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setIsLocationOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={saveLocationSettings}>
                Save defaults
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
        aria-label="Invoice preview"
        aria-hidden={!isPreviewOpen}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          <h3 className="title" style={{ margin: 0 }}>
            Invoice preview
          </h3>
          <button className="btn btn-secondary" type="button" onClick={() => setIsPreviewOpen(false)}>
            Close
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
