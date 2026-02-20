import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import InvoiceItemsTable from '../components/InvoiceItemsTable';
import {
  computeDueDate,
  formatInvoiceNumberShort,
  formatMoney,
  formatPaymentTerms,
  formatShortDate
} from '../lib/formatters';

const defaultTemplateTheme = {
  primaryColor: '#1677ff',
  textColor: '#111827',
  tableHeaderBg: '#111827',
  tableHeaderText: '#ffffff',
  borderColor: '#e2e8f0'
};

function safeParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mergeTheme(parsed) {
  return { ...defaultTemplateTheme, ...(parsed?.theme || {}) };
}

function PublicInvoiceView() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang') || '';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/public/invoices/${encodeURIComponent(token)}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (cancelled) return;

        if (res.status === 404 || res.status === 410) {
          setError('This invoice link has expired or is no longer available.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('Unable to load invoice. Please try again later.');
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (cancelled) return;
        setData(json);
      } catch {
        if (!cancelled) setError('Unable to load invoice. Please check your connection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchInvoice();
    return () => { cancelled = true; };
  }, [token]);

  const invoice = data?.invoice;
  const business = data?.business;
  const template = data?.template;

  const theme = useMemo(() => {
    const parsed = safeParseJson(template?.config_json);
    return mergeTheme(parsed);
  }, [template?.config_json]);

  const paperVars = useMemo(() => ({
    '--invoice-template-primary': theme.primaryColor,
    '--invoice-template-text': theme.textColor,
    '--invoice-template-border': theme.borderColor,
    '--invoice-template-table-header-bg': theme.tableHeaderBg || theme.primaryColor,
    '--invoice-template-table-header-text': theme.tableHeaderText
  }), [theme]);

  const currency = invoice?.currency || null;

  const displayNumber = useMemo(() => {
    if (invoice?.invoice_number) return formatInvoiceNumberShort(invoice.invoice_number);
    return 'Invoice';
  }, [invoice?.invoice_number]);

  const dueDate = computeDueDate(invoice?.invoice_date, invoice?.invoice_payment_terms);

  const formatNum = useMemo(
    () => new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const itemRows = useMemo(
    () =>
      (invoice?.details || []).map((line, i) => {
        const qty = Number(line?.detail_qty || line?.detailQty || 0);
        const rate = Number(line?.detail_unit_rate || line?.detailUnitRate || 0);
        const discount = Number(line?.detail_discount || line?.detailDiscount || 0);
        const amount = qty * rate - discount;
        return {
          id: line?.id || `${i}`,
          name: line?.name || '--',
          description: '',
          qty,
          rate: formatNum.format(rate),
          amount: formatNum.format(amount)
        };
      }),
    [invoice?.details, formatNum]
  );

  const totals = useMemo(() => {
    const lines = invoice?.details ?? [];
    const subtotal = lines.reduce(
      (sum, l) =>
        sum +
        Number(l.detail_qty || l.detailQty || 0) * Number(l.detail_unit_rate || l.detailUnitRate || 0),
      0
    );
    const discount = lines.reduce(
      (sum, l) => sum + Number(l.detail_discount || l.detailDiscount || 0),
      0
    );
    return { subtotal, discount, total: subtotal - discount };
  }, [invoice?.details]);

  const businessName = (business?.business_name || business?.name || '').trim();
  const businessPhone = (business?.phone || '').trim();
  const businessAddress = [business?.address, business?.city].filter(Boolean).join(', ').trim();

  const customerName = invoice?.customer?.name || '--';
  const remainingBalance = Number(invoice?.remaining_balance || invoice?.remainingBalance || 0);

  if (loading) {
    return (
      <div className="public-invoice-shell">
        <div className="stack">
          <section className="state-loading" aria-live="polite">
            <div className="skeleton-card">
              <div className="skeleton skeleton-line long" />
              <div className="skeleton skeleton-line short" />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-invoice-shell">
        <div className="stack">
          <section className="state-error public-error-card" role="alert">
            <p className="state-title">Invoice unavailable</p>
            <p className="state-message">{error}</p>
          </section>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="public-invoice-shell">
        <div className="stack">
          <section className="state-empty" role="status">
            <p className="state-title">Invoice not found</p>
            <p className="state-message">This link may have expired or the invoice has been removed.</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="public-invoice-shell">
      <div className="stack invoice-view">
        <section className="invoice-paper-wrap" aria-label="Invoice">
          <div className="invoice-paper invoice-paper-template" style={paperVars}>
            <div className="invoice-paper-head">
              <div className="invoice-paper-brand" aria-label="Business identity">
                {businessName && <p className="invoice-paper-brand-title">{businessName}</p>}
                {businessPhone && <p className="invoice-paper-brand-subtle">{businessPhone}</p>}
                {businessAddress && <p className="invoice-paper-brand-subtle">{businessAddress}</p>}
              </div>

              <div className="invoice-paper-title">
                <div className="invoice-paper-heading">INVOICE</div>
                <div className="invoice-paper-number"># {displayNumber}</div>
                <div className="invoice-paper-balance">
                  <div className="invoice-paper-balance-label">Remaining Balance</div>
                  <div className="invoice-paper-balance-value">
                    {formatMoney(remainingBalance, currency)}
                  </div>
                </div>
              </div>
            </div>

            <div className="invoice-paper-grid">
              <div className="invoice-paper-block">
                <div className="invoice-paper-block-label">Bill To</div>
                <div className="invoice-paper-block-value">{customerName}</div>
              </div>

              <div className="invoice-paper-block">
                <div className="invoice-paper-block-row">
                  <span>Invoice Date</span>
                  <span>{formatShortDate(invoice.invoice_date)}</span>
                </div>
                <div className="invoice-paper-block-row">
                  <span>Payment Terms</span>
                  <span>{formatPaymentTerms(invoice.invoice_payment_terms)}</span>
                </div>
                <div className="invoice-paper-block-row">
                  <span>Due Date</span>
                  <span>{dueDate ? formatShortDate(dueDate.toISOString()) : '--'}</span>
                </div>
              </div>
            </div>

            <div className="invoice-table">
              <InvoiceItemsTable
                ariaLabel="Invoice line items"
                labels={{ item: 'Item', qty: 'Qty', rate: 'Rate', amount: 'Amount' }}
                items={itemRows}
              />
            </div>

            <div className="invoice-totals">
              <div className="invoice-totals-card">
                <div className="invoice-total-row">
                  <span>Subtotal</span>
                  <span>{formatMoney(totals.subtotal, currency)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="invoice-total-row">
                    <span>Discount</span>
                    <span>-{formatMoney(totals.discount, currency)}</span>
                  </div>
                )}
                <div className="invoice-total-row invoice-total-strong">
                  <span>Total</span>
                  <span>{formatMoney(totals.total, currency)}</span>
                </div>
                <div className="invoice-total-row">
                  <span>Remaining</span>
                  <span>{formatMoney(remainingBalance, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="public-invoice-footer">
          <p>Powered by <strong>Cashfloweasy</strong></p>
        </footer>
      </div>
    </div>
  );
}

export default PublicInvoiceView;
