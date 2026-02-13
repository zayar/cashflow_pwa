import { useI18n } from '../i18n';
import InvoiceItemsTable from './InvoiceItemsTable';

const demoItems = [
  {
    id: 'line-1',
    name: 'Consulting Services',
    description: 'January services',
    qty: 1,
    rate: '150,000',
    amount: '150,000'
  },
  {
    id: 'line-2',
    name: 'Implementation',
    description: 'Setup & onboarding',
    qty: 1,
    rate: '350,000',
    amount: '350,000'
  }
];

function TemplateInvoicePreview({ logoUrl, qrUrl }) {
  const { t } = useI18n();

  return (
    <div className="template-preview">
      <div className="template-preview-top">
        <div className="template-preview-logo" aria-label="Logo preview">
          {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span>Logo</span>}
        </div>
        <div className="template-preview-header">
          <div className="template-preview-title">{t('templatePreview.invoice')}</div>
          <div className="template-preview-number"># INV-0001</div>
          <div className="template-preview-date">06 Feb 2026</div>
        </div>
      </div>

      <div className="template-preview-meta">
        <div className="template-preview-block">
          <div className="template-preview-label">{t('templatePreview.billTo')}</div>
          <div className="template-preview-value">Acme Trading Co.</div>
          <div className="template-preview-sub">Yangon, Myanmar</div>
          <div className="template-preview-sub">+95 9 123 456 789</div>
        </div>
        <div className="template-preview-block template-preview-right">
          <div className="template-preview-detail-row">
            <span>{t('templatePreview.invoiceDate')}</span>
            <span>06 Feb 2026</span>
          </div>
          <div className="template-preview-detail-row">
            <span>{t('templatePreview.dueDate')}</span>
            <span>13 Feb 2026</span>
          </div>
          <div className="template-preview-detail-row">
            <span>{t('templatePreview.paymentTerms')}</span>
            <span>Net 7</span>
          </div>
        </div>
      </div>

      <InvoiceItemsTable
        className="template-preview-table"
        ariaLabel="Invoice line items"
        labels={{
          item: t('templatePreview.item'),
          qty: t('templatePreview.qty'),
          rate: t('templatePreview.rate'),
          amount: t('templatePreview.amount')
        }}
        items={demoItems}
      />

      <div className="template-preview-summary">
        <div className="template-preview-summary-row">
          <span>{t('templatePreview.subTotal')}</span>
          <span>MMK 500,000</span>
        </div>
        <div className="template-preview-summary-row">
          <span>{t('templatePreview.tax')}</span>
          <span>MMK 0</span>
        </div>
        <div className="template-preview-summary-row template-preview-summary-total">
          <span>{t('templatePreview.total')}</span>
          <span>MMK 500,000</span>
        </div>
      </div>

      <div className="template-preview-footer">
        <div className="template-preview-notes">
          <div className="template-preview-label">{t('templatePreview.notes')}</div>
          <p>{t('templatePreview.notesText')}</p>
        </div>
        <div className="template-preview-pay">
          <div className="template-preview-qr">
            {qrUrl ? <img src={qrUrl} alt="QR" /> : <span>QR</span>}
          </div>
          <div className="template-preview-pay-text">
            <span>{t('templatePreview.scanToPay')}</span>
            <strong>MMK 500,000</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateInvoicePreview;
