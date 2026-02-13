import { useI18n } from '../i18n';
import { resolveStorageAccessUrl } from '../lib/uploadApi';
import { useBusinessProfile } from '../state/businessProfile';

function currency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatTerms(value, t) {
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
}

function InvoicePreview({ invoice }) {
  const { t } = useI18n();
  const { profile } = useBusinessProfile();
  const subtotal = invoice.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.rate || 0), 0);
  const discounts = invoice.lines.reduce((sum, line) => sum + Number(line.discount || 0), 0);
  const total = subtotal - discounts;
  const businessName = String(profile?.businessName || profile?.name || '').trim();
  const businessPhone = String(profile?.phone || '').trim();
  const businessAddress = [String(profile?.address || '').trim(), String(profile?.city || '').trim()].filter(Boolean).join(', ');
  const logoUrl = resolveStorageAccessUrl(profile?.logoUrl || '');

  return (
    <div className="preview">
      {(businessName || logoUrl || businessPhone || businessAddress) && (
        <div className="preview-divider" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
            {logoUrl && <img src={logoUrl} alt="" className="invoice-preview-logo" loading="lazy" />}
            <div style={{ minWidth: 0 }}>
              {businessName && <p style={{ margin: 0, fontWeight: 800 }}>{businessName}</p>}
              {businessPhone && (
                <p className="subtle" style={{ marginTop: 3, fontSize: 12 }}>
                  {businessPhone}
                </p>
              )}
              {businessAddress && (
                <p className="subtle" style={{ marginTop: 3, fontSize: 12 }}>
                  {businessAddress}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800 }}>{t('invoicePreview.title')}</p>
          <p className="subtle" style={{ fontSize: 13 }}>
            {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : t('invoicePreview.draft')}
          </p>
        </div>
        <span className="meta-chip" style={{ color: '#eaf3ff', borderColor: 'rgba(226, 239, 255, 0.3)', background: 'rgba(11, 28, 54, 0.45)' }}>
          {formatTerms(invoice.paymentTerms, t)}
        </span>
      </div>

      <p className="subtle" style={{ marginBottom: 4 }}>
        {t('invoicePreview.customer')}: {invoice.customerName || '--'}
      </p>
      <p className="subtle" style={{ marginBottom: 10 }}>
        {t('invoicePreview.date')}: {invoice.invoiceDate || '--'}
      </p>

      <div className="preview-divider">
        {invoice.lines.map((line) => (
          <div className="preview-line" key={line.id}>
            <span>
              {line.name || t('invoicePreview.item')} x {Number(line.qty || 0)}
            </span>
            <span>{currency(Number(line.qty || 0) * Number(line.rate || 0))}</span>
          </div>
        ))}
      </div>

      <div className="preview-divider">
        <div className="preview-line">
          <span>{t('invoicePreview.subtotal')}</span>
          <span>{currency(subtotal)}</span>
        </div>
        <div className="preview-line">
          <span>{t('invoicePreview.discounts')}</span>
          <span>-{currency(discounts)}</span>
        </div>
        <div className="preview-line" style={{ fontWeight: 800, marginBottom: 0 }}>
          <span>{t('invoicePreview.total')}</span>
          <span>{currency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default InvoicePreview;
