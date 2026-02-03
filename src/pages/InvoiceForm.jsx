import { useMemo, useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import InvoicePreview from '../components/InvoicePreview';
import InvoiceLineCard from '../components/InvoiceLineCard';
import AdvancedFields from '../components/AdvancedFields';
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

function InvoiceForm() {
  const navigate = useNavigate();
  const { state: invoice, dispatch } = useInvoiceDraft();
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({ customer: '', lines: [] });
  const [createInvoice, { loading: saving, error: saveError }] = useMutation(CREATE_INVOICE);

  const totals = useMemo(() => {
    const subtotal = invoice.lines.reduce((sum, line) => sum + (line.qty || 0) * (line.rate || 0), 0);
    const discount = invoice.lines.reduce((sum, line) => sum + (line.discount || 0), 0);
    const tax = 0;
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [invoice.lines]);

  const openCustomerPicker = () => navigate('/pick/customer');

  const openItemPicker = (lineId) => navigate(`/pick/item?lineId=${lineId}`);

  const addLineAndPick = () => {
    const line = createLine();
    dispatch({ type: 'addLineWith', line });
    openItemPicker(line.id);
  };

  const validate = () => {
    const nextErrors = { customer: '', lines: [] };
    if (!invoice.customerId) {
      nextErrors.customer = 'Please choose a customer.';
    }
    if (invoice.lines.length === 0) {
      nextErrors.lines = ['__empty__'];
      setErrors(nextErrors);
      return false;
    }
    const missingLineIds = invoice.lines.filter((line) => !line.name).map((line) => line.id);
    if (missingLineIds.length > 0) {
      nextErrors.lines = missingLineIds;
    }
    setErrors(nextErrors);
    return !nextErrors.customer && missingLineIds.length === 0;
  };

  const handleSave = async () => {
    setStatus('');
    if (!validate()) return;

    const isoDate = invoice.invoiceDate
      ? new Date(`${invoice.invoiceDate}T00:00:00Z`).toISOString()
      : new Date().toISOString();

    const input = {
      customerId: Number(invoice.customerId),
      branchId: Number(invoice.branchId),
      warehouseId: Number(invoice.warehouseId),
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
    setStatus(`Saved invoice ${number || ''}`.trim());
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

  return (
    <div className="invoice-page">
      <div className="section-card">
        <div className="invoice-header">
          <div>
            <div className="invoice-label">Invoice No</div>
            <div className="invoice-number">{invoice.invoiceNumber || 'New'}</div>
          </div>
          <div className="invoice-meta">
            <label className="field">
              <span className="label">Date</span>
              <input
                className="input"
                type="date"
                value={invoice.invoiceDate}
                onChange={(e) => dispatch({ type: 'setField', field: 'invoiceDate', value: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="label">Payment terms</span>
              <select
                className="input"
                value={invoice.paymentTerms}
                onChange={(e) => dispatch({ type: 'setField', field: 'paymentTerms', value: e.target.value })}
              >
                {paymentTermsOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <button type="button" className="row-button" onClick={openCustomerPicker}>
          <div className="row-label">To</div>
          <div className={`row-value ${invoice.customerName ? '' : 'row-placeholder'}`}>
            {invoice.customerName || 'Select customer'}
          </div>
          <div className="row-chevron">›</div>
        </button>
        {errors.customer && <div className="inline-error">{errors.customer}</div>}
      </div>

      <div className="section-card">
        <div className="section-title">
          <span>Lines</span>
          <button className="btn btn-secondary" type="button" onClick={addLineAndPick}>
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
              onChangeDiscount={(value) => dispatch({ type: 'updateLine', lineId: line.id, field: 'discount', value })}
              onToggleTaxable={(value) => dispatch({ type: 'updateLine', lineId: line.id, field: 'taxable', value })}
              onRemove={() => dispatch({ type: 'removeLine', lineId: line.id })}
            />
          ))}
        </div>
        {errors.lines.includes('__empty__') && (
          <div className="inline-error">Add at least one line item.</div>
        )}
      </div>

      <div className="section-card">
        <label className="field">
          <span className="label">Notes</span>
          <textarea
            className="input"
            rows="3"
            value={invoice.notes}
            onChange={(e) => dispatch({ type: 'setField', field: 'notes', value: e.target.value })}
            placeholder="Add a note (optional)"
          />
        </label>
      </div>

      <div className="section-card summary-card">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Discount</span>
          <span>-${totals.discount.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Tax</span>
          <span>${totals.tax.toFixed(2)}</span>
        </div>
        <div className="summary-row summary-total">
          <span>Total</span>
          <span>${totals.total.toFixed(2)}</span>
        </div>
      </div>

      <AdvancedFields
        values={invoice}
        onChange={(field, value) => dispatch({ type: 'setField', field, value })}
      />

      <InvoicePreview invoice={invoice} />

      {status && <p className="subtle">{status}</p>}
      {saveError && <p className="subtle" style={{ color: '#ef4444' }}>{saveError.message}</p>}

      <div className="sticky-actions">
        <button className="btn btn-secondary" type="button" onClick={handleShareLink}>
          Share link
        </button>
        <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default InvoiceForm;
