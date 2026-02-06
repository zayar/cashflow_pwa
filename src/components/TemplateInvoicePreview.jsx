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
  return (
    <div className="template-preview">
      <div className="template-preview-top">
        <div className="template-preview-logo" aria-label="Logo preview">
          {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span>Logo</span>}
        </div>
        <div className="template-preview-header">
          <div className="template-preview-title">INVOICE</div>
          <div className="template-preview-number"># INV-0001</div>
          <div className="template-preview-date">06 Feb 2026</div>
        </div>
      </div>

      <div className="template-preview-meta">
        <div className="template-preview-block">
          <div className="template-preview-label">Bill To</div>
          <div className="template-preview-value">Acme Trading Co.</div>
          <div className="template-preview-sub">Yangon, Myanmar</div>
          <div className="template-preview-sub">+95 9 123 456 789</div>
        </div>
        <div className="template-preview-block template-preview-right">
          <div className="template-preview-detail-row">
            <span>Invoice date</span>
            <span>06 Feb 2026</span>
          </div>
          <div className="template-preview-detail-row">
            <span>Due date</span>
            <span>13 Feb 2026</span>
          </div>
          <div className="template-preview-detail-row">
            <span>Payment terms</span>
            <span>Net 7</span>
          </div>
        </div>
      </div>

      <div className="template-preview-table" role="table" aria-label="Invoice line items">
        <div className="template-preview-row template-preview-row-header" role="row">
          <div className="template-preview-cell">Item</div>
          <div className="template-preview-cell template-preview-cell-right">Qty</div>
          <div className="template-preview-cell template-preview-cell-right">Rate</div>
          <div className="template-preview-cell template-preview-cell-right">Amount</div>
        </div>
        {demoItems.map((item) => (
          <div className="template-preview-row" role="row" key={item.id}>
            <div className="template-preview-cell">
              <div className="template-preview-item-name">{item.name}</div>
              <div className="template-preview-item-desc">{item.description}</div>
            </div>
            <div className="template-preview-cell template-preview-cell-right">{item.qty}</div>
            <div className="template-preview-cell template-preview-cell-right">{item.rate}</div>
            <div className="template-preview-cell template-preview-cell-right">{item.amount}</div>
          </div>
        ))}
      </div>

      <div className="template-preview-summary">
        <div className="template-preview-summary-row">
          <span>Sub Total</span>
          <span>MMK 500,000</span>
        </div>
        <div className="template-preview-summary-row">
          <span>Tax</span>
          <span>MMK 0</span>
        </div>
        <div className="template-preview-summary-row template-preview-summary-total">
          <span>Total</span>
          <span>MMK 500,000</span>
        </div>
      </div>

      <div className="template-preview-footer">
        <div className="template-preview-notes">
          <div className="template-preview-label">Notes</div>
          <p>Thanks for your business. Please scan to pay.</p>
        </div>
        <div className="template-preview-pay">
          <div className="template-preview-qr">
            {qrUrl ? <img src={qrUrl} alt="QR" /> : <span>QR</span>}
          </div>
          <div className="template-preview-pay-text">
            <span>Scan to pay</span>
            <strong>MMK 500,000</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateInvoicePreview;
