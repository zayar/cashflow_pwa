import { useEffect, useMemo, useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import InvoicePreview from '../components/InvoicePreview';
import InvoiceLineCard from '../components/InvoiceLineCard';
import { createLine, useInvoiceDraft } from '../state/invoiceDraft';
import { buildInvoiceShareUrl, createInvoiceShareToken } from '../lib/shareApi';

const CREATE_INVOICE = gql`
  mutation CreateInvoice($input: NewSalesInvoice!) {
    createSalesInvoice(input: $input) {
      id
      invoiceNumber
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

function InvoiceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: invoice, dispatch } = useInvoiceDraft();

  const [step, setStep] = useState(() => parseStepParam(searchParams.get('step')));
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({ customer: '', lines: [] });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [createInvoice, { loading: saving, error: saveError }] = useMutation(CREATE_INVOICE);

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

  const openCustomerPicker = () => navigate('/pick/customer');
  const openItemPicker = (lineId) => navigate(`/pick/item?lineId=${lineId}&returnStep=items`);

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

    const isoDate = invoice.invoiceDate
      ? new Date(`${invoice.invoiceDate}T00:00:00Z`).toISOString()
      : new Date().toISOString();

    const input = {
      customerId: Number(invoice.customerId),
      ...(invoice.branchId ? { branchId: Number(invoice.branchId) } : {}),
      ...(invoice.warehouseId ? { warehouseId: Number(invoice.warehouseId) } : {}),
      currencyId: Number(invoice.currencyId),
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

    const { data } = await createInvoice({ variables: { input } });
    const number = data?.createSalesInvoice?.invoiceNumber || data?.createSalesInvoice?.id;
    const id = data?.createSalesInvoice?.id;
    if (number) dispatch({ type: 'setInvoiceNumber', invoiceNumber: number });
    if (id) dispatch({ type: 'setInvoiceId', invoiceId: id });
    setStatus(`Invoice ${number || ''} saved.`.trim());
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

    await handleSave();
  };

  const primaryLabel =
    step === 0 ? 'Continue to items' : step === 1 ? 'Continue to review' : saving ? 'Saving...' : 'Save invoice';

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
    const raw = saveError?.message || '';
    const lowered = raw.toLowerCase();

    if (lowered.includes('branch not found') || lowered.includes('warehouse not found')) {
      return 'Default branch or warehouse is missing. Set the default values in Cashflow Web, then retry.';
    }
    return raw;
  }, [saveError]);

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
              Branch: {invoice.branchId ? `#${invoice.branchId}` : 'Account default'}
            </span>
            <span className="meta-chip">
              Warehouse: {invoice.warehouseId ? `#${invoice.warehouseId}` : 'Account default'}
            </span>
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
        </section>
      )}

      {(status || saveError) && (
        <section className={saveError ? 'state-error' : 'surface-card'} role="status" aria-live="polite">
          <p style={{ margin: 0 }}>{saveError ? saveErrorMessage : status}</p>
        </section>
      )}

      <div className={`sheet-backdrop ${isPreviewOpen ? 'open' : ''}`} onClick={() => setIsPreviewOpen(false)} />
      <section
        className={`sheet ${isPreviewOpen ? 'open' : ''}`}
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
