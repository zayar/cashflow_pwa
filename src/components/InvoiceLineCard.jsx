function formatAmount(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(2)}`;
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
  const amount = (Number(line.qty || 0) * Number(line.rate || 0)) - Number(line.discount || 0);

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
            onChange={(e) => onChangeQty(Number(e.target.value))}
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
            onChange={(e) => onChangeRate(Number(e.target.value))}
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
            onChange={(e) => onChangeDiscount(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="line-actions">
        <label className="toggle">
          <input
            type="checkbox"
            checked={line.taxable}
            onChange={(e) => onToggleTaxable(e.target.checked)}
          />
          <span>Taxable</span>
        </label>
        <button className="btn btn-secondary" type="button" onClick={onRemove}>
          Remove
        </button>
      </div>

      {showError && (
        <div className="inline-error">Please select an item for this line.</div>
      )}
    </div>
  );
}

export default InvoiceLineCard;
