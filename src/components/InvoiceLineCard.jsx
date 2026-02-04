function formatAmount(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(2)}`;
}

function parseNumber(value) {
  if (value === '' || Number.isNaN(Number(value))) return 0;
  return Number(value);
}

function InvoiceLineCard({
  line,
  onSelectItem,
  onChangeQty,
  onChangeRate,
  onChangeDiscount,
  onToggleTaxable,
  onRemove,
  showError
}) {
  const amount = Number(line.qty || 0) * Number(line.rate || 0) - Number(line.discount || 0);

  return (
    <div className={`line-card ${showError ? 'line-card-error' : ''}`}>
      <button type="button" className="line-item-button" onClick={onSelectItem}>
        <div>
          <div className="line-title">{line.name || 'Select item'}</div>
          <div className="line-subtitle">{line.name ? 'Tap to change item' : 'Tap to choose an item'}</div>
        </div>
        <div className="line-amount">{formatAmount(amount)}</div>
      </button>

      <div className="line-fields">
        <label className="field">
          <span className="label">Qty</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={line.qty}
            onChange={(event) => onChangeQty(parseNumber(event.target.value))}
          />
        </label>
        <label className="field">
          <span className="label">Rate</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={line.rate}
            onChange={(event) => onChangeRate(parseNumber(event.target.value))}
          />
        </label>
        <label className="field">
          <span className="label">Discount</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={line.discount}
            onChange={(event) => onChangeDiscount(parseNumber(event.target.value))}
          />
        </label>
      </div>

      <div className="line-actions">
        <label className="toggle">
          <input type="checkbox" checked={line.taxable} onChange={(event) => onToggleTaxable(event.target.checked)} />
          <span>Taxable</span>
        </label>
        <button className="btn btn-secondary" type="button" onClick={onRemove}>
          Remove line
        </button>
      </div>

      {showError && <div className="inline-error">Please select an item for this line.</div>}
    </div>
  );
}

export default InvoiceLineCard;
