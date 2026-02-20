import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import InvoiceItemsTable from '../components/InvoiceItemsTable';
import { useI18n } from '../i18n';
import {
  computeDueDate,
  formatInvoiceNumberShort,
  formatMoney,
  formatPaymentTerms,
  formatShortDate
} from '../lib/formatters';
import { resolveStorageAccessUrl, uploadToSignedUrl } from '../lib/uploadApi';

const defaultTemplateConfig = {
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
  },
  footer: {
    termsText: '',
    qrTitle: '',
    qrImageUrl: ''
  }
};

function safeParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mergeConfig(parsed) {
  return {
    ...defaultTemplateConfig,
    ...parsed,
    theme: { ...defaultTemplateConfig.theme, ...(parsed?.theme || {}) },
    header: { ...defaultTemplateConfig.header, ...(parsed?.header || {}) },
    footer: { ...defaultTemplateConfig.footer, ...(parsed?.footer || {}) }
  };
}

function PublicInvoiceView() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get('lang') || '';
  const { t, setLang } = useI18n();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [proofs, setProofs] = useState([]);
  const [proofStatus, setProofStatus] = useState('');
  const [proofError, setProofError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    const normalized = String(lang || '').trim().toLowerCase();
    if (normalized) setLang(normalized);
  }, [lang, setLang]);

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

  const templateConfig = useMemo(() => {
    const parsed = safeParseJson(template?.config_json);
    return mergeConfig(parsed);
  }, [template?.config_json]);

  const theme = templateConfig?.theme || defaultTemplateConfig.theme;

  const paperVars = useMemo(() => ({
    '--invoice-template-primary': theme.primaryColor,
    '--invoice-template-text': theme.textColor,
    '--invoice-template-border': theme.borderColor,
    '--invoice-template-table-header-bg': theme.tableHeaderBg || theme.primaryColor,
    '--invoice-template-table-header-text': theme.tableHeaderText
  }), [theme]);

  const currency = invoice?.currency || null;
  const showLogo = templateConfig?.header?.showLogo !== false;
  const logoUrl = useMemo(() => {
    if (!showLogo) return '';
    const fromTemplate = templateConfig?.header?.logoUrl || '';
    const fromBusiness = business?.logo_url || business?.logoUrl || '';
    return resolveStorageAccessUrl(fromTemplate || fromBusiness);
  }, [business?.logoUrl, business?.logo_url, showLogo, templateConfig?.header?.logoUrl]);

  const qrUrl = useMemo(() => {
    return resolveStorageAccessUrl(templateConfig?.footer?.qrImageUrl || '');
  }, [templateConfig?.footer?.qrImageUrl]);
  const qrTitle = useMemo(() => String(templateConfig?.footer?.qrTitle || '').trim(), [templateConfig?.footer?.qrTitle]);
  const termsText = useMemo(() => String(templateConfig?.footer?.termsText || '').trim(), [templateConfig?.footer?.termsText]);

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

  const loadProofs = async () => {
    if (!token) return;
    setProofError('');
    try {
      const res = await fetch(`/public/invoices/${encodeURIComponent(token)}/payment-proofs`, {
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setProofError(json?.error || 'Unable to load payment proofs.');
        return;
      }
      setProofs(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setProofError('Unable to load payment proofs. Please check your connection.');
    }
  };

  useEffect(() => {
    if (!invoice) return;
    loadProofs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id, token]);

  const handleUploadProof = async (file) => {
    if (!token || !file) return;
    setProofStatus('');
    setProofError('');
    setUploading(true);
    try {
      const signRes = await fetch(`/public/invoices/${encodeURIComponent(token)}/payment-proofs/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size
        })
      });
      const signJson = await signRes.json().catch(() => null);
      if (!signRes.ok || !signJson?.data) {
        throw new Error(signJson?.error || 'Unable to start upload.');
      }

      await uploadToSignedUrl({ signed: signJson.data, file });

      const completeRes = await fetch(`/public/invoices/${encodeURIComponent(token)}/payment-proofs/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          objectKey: signJson.data.objectKey,
          mimeType: file.type
        })
      });
      const completeJson = await completeRes.json().catch(() => null);
      if (!completeRes.ok || !completeJson?.data) {
        throw new Error(completeJson?.error || 'Unable to complete upload.');
      }

      setProofStatus('Payment proof uploaded.');
      await loadProofs();
    } catch (e) {
      setProofError(e?.message || 'Unable to upload payment proof.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProof = async (doc) => {
    const id = Number(doc?.id || 0);
    if (!token || !id) return;
    const ok = window.confirm('Remove this payment proof image?');
    if (!ok) return;
    setProofStatus('');
    setProofError('');
    try {
      const res = await fetch(`/public/invoices/${encodeURIComponent(token)}/payment-proofs/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Unable to delete payment proof.');
      }
      setProofStatus('Payment proof removed.');
      await loadProofs();
    } catch (e) {
      setProofError(e?.message || 'Unable to delete payment proof.');
    }
  };

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
                {logoUrl && <img src={logoUrl} alt="" className="invoice-paper-logo-image" loading="lazy" />}
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

            {(termsText || qrUrl) && (
              <div className="template-preview-footer" style={{ marginTop: 18 }}>
                <div className="template-preview-notes">
                  <div className="template-preview-label">{t('templatePreview.notes')}</div>
                  <p>{termsText || '--'}</p>
                </div>
                {qrUrl && (
                  <div className="template-preview-pay">
                    <div className="template-preview-qr">
                      <img src={qrUrl} alt="QR" loading="lazy" />
                    </div>
                    <div className="template-preview-pay-text">
                      <span>{qrTitle || t('templatePreview.scanToPay')}</span>
                      <strong>{formatMoney(totals.total, currency)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="card" aria-label="Upload payment proof" style={{ marginTop: 14 }}>
          <p className="kicker">Upload Payment Proof</p>
          <p className="subtle" style={{ marginTop: 6 }}>
            Add up to 5 images (JPG/PNG/WebP). Max 5MB each.
          </p>

          <div className="toolbar" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label className="btn btn-secondary" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? 'Uploading...' : 'Choose image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (files.length === 0) return;
                  // Upload sequentially to keep status/errors predictable.
                  (async () => {
                    for (const file of files) {
                      // Stop when we reach max proofs.
                      if ((proofs?.length || 0) >= 5) break;
                      // eslint-disable-next-line no-await-in-loop
                      await handleUploadProof(file);
                    }
                  })();
                }}
              />
            </label>
            {proofStatus && <span className="meta-chip">{proofStatus}</span>}
          </div>

          {proofError && (
            <p className="subtle" style={{ color: '#b91c1c', marginTop: 10 }}>
              {proofError}
            </p>
          )}

          {proofs.length > 0 && (
            <div className="cf-thumb-grid" style={{ marginTop: 12 }}>
              {proofs.map((doc) => {
                const viewUrl = String(doc?.viewUrl || '').trim();
                const src = viewUrl || resolveStorageAccessUrl(doc?.documentUrl || '');
                if (!src) return null;
                return (
                  <div
                    key={doc?.id || doc?.documentUrl}
                    style={{ position: 'relative' }}
                  >
                    <button className="cf-thumb" type="button" aria-label="Open payment proof" onClick={() => setPreviewUrl(src)}>
                      <img src={src} alt="" loading="lazy" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove payment proof"
                      title="Remove"
                      onClick={() => handleDeleteProof(doc)}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        border: '1px solid rgba(15, 23, 42, 0.12)',
                        background: 'rgba(255, 255, 255, 0.92)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {previewUrl && (
          <Modal title="Payment proof" onClose={() => setPreviewUrl('')}>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <img
                src={previewUrl}
                alt="Payment proof"
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 12 }}
              />
              <div className="toolbar" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <a className="btn btn-secondary" href={previewUrl} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </div>
            </div>
          </Modal>
        )}

        <footer className="public-invoice-footer">
          <p>Powered by <strong>Cashfloweasy</strong></p>
        </footer>
      </div>
    </div>
  );
}

export default PublicInvoiceView;
