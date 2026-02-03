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
      return value || '—';
  }
}

function InvoicePreview({ invoice }) {
  const subtotal = invoice.lines.reduce((sum, line) => sum + line.qty * line.rate, 0);
  const total = subtotal - invoice.lines.reduce((sum, line) => sum + line.discount, 0);

  return (
    <div className="preview">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Preview</div>
          <div className="subtle">Invoice draft</div>
        </div>
        <div className="chip">{formatTerms(invoice.paymentTerms)}</div>
      </div>
      <div className="subtle" style={{ marginBottom: 4 }}>Customer: {invoice.customerName || '—'}</div>
      <div className="subtle" style={{ marginBottom: 12 }}>Date: {invoice.invoiceDate}</div>
      <div style={{ borderTop: '1px solid #1f2937', paddingTop: 8 }}>
        {invoice.lines.map((line, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>{line.name || 'Item'} × {line.qty}</span>
            <span>{currency(line.qty * line.rate)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #1f2937', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span>
        <span>{currency(subtotal)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Discounts</span>
        <span>-{currency(invoice.lines.reduce((sum, l) => sum + l.discount, 0))}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 4 }}>
        <span>Total</span>
        <span>{currency(total)}</span>
      </div>
    </div>
  );
}

export default InvoicePreview;
