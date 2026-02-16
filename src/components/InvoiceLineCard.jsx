import { useI18n } from '../i18n';
import { formatMoney } from '../lib/formatters';

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
  showError,
  currency
}) {
  const { t } = useI18n();
  const amount = Number(line.qty || 0) * Number(line.rate || 0) - Number(line.discount || 0);

  return (
    <div className={`line-card ${showError ? 'line-card-error' : ''}`}>
      <button type="button" className="line-item-button" onClick={onSelectItem}>
        <div>
          <div className="line-title">{line.name || t('invoiceLine.selectItem')}</div>
          <div className="line-subtitle">{line.name ? t('invoiceLine.tapToChange') : t('invoiceLine.tapToChoose')}</div>
        </div>
        <div className="line-amount">{formatMoney(amount, currency)}</div>
      </button>

      <div className="line-fields">
        <label className="field">
          <span className="label">{t('invoiceLine.qty')}</span>
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
          <span className="label">{t('invoiceLine.rate')}</span>
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
          <span className="label">{t('invoiceLine.discount')}</span>
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
          <span>{t('invoiceLine.taxable')}</span>
        </label>
        <button className="btn btn-secondary" type="button" onClick={onRemove}>
          {t('invoiceLine.removeLine')}
        </button>
      </div>

      {showError && <div className="inline-error">{t('invoiceLine.selectItemForLine')}</div>}
    </div>
  );
}

export default InvoiceLineCard;
