function currency(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatTerms(value) {
  switch (value) {
    case 'DueOnReceipt':
      return 'Due on receipt';
    case 'Net7':
      return 'Net 7';
    case 'Net15':
      return 'Net 15';
    case 'Net30':
      return 'Net 30';
    default:
      return value || '--';
  }
}

function InvoicePreview({ invoice }) {
  const subtotal = invoice.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.rate || 0), 0);
  const discounts = invoice.lines.reduce((sum, line) => sum + Number(line.discount || 0), 0);
  const total = subtotal - discounts;

  return (
    <div className="preview">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800 }}>Invoice preview</p>
          <p className="subtle" style={{ fontSize: 13 }}>
            {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : 'Draft'}
          </p>
        </div>
        <span className="meta-chip" style={{ color: '#eaf3ff', borderColor: 'rgba(226, 239, 255, 0.3)', background: 'rgba(11, 28, 54, 0.45)' }}>
          {formatTerms(invoice.paymentTerms)}
        </span>
      </div>

      <p className="subtle" style={{ marginBottom: 4 }}>
        Customer: {invoice.customerName || '--'}
      </p>
      <p className="subtle" style={{ marginBottom: 10 }}>
        Date: {invoice.invoiceDate || '--'}
      </p>

      <div className="preview-divider">
        {invoice.lines.map((line) => (
          <div className="preview-line" key={line.id}>
            <span>
              {line.name || 'Item'} x {Number(line.qty || 0)}
            </span>
            <span>{currency(Number(line.qty || 0) * Number(line.rate || 0))}</span>
          </div>
        ))}
      </div>

      <div className="preview-divider">
        <div className="preview-line">
          <span>Subtotal</span>
          <span>{currency(subtotal)}</span>
        </div>
        <div className="preview-line">
          <span>Discounts</span>
          <span>-{currency(discounts)}</span>
        </div>
        <div className="preview-line" style={{ fontWeight: 800, marginBottom: 0 }}>
          <span>Total</span>
          <span>{currency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default InvoicePreview;
