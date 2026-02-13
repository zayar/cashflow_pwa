function getCellText(value, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

function InvoiceItemsTable({ items = [], labels = {}, ariaLabel = 'Invoice line items', className = '' }) {
  const tableClassName = ['invoice-items-table', className].filter(Boolean).join(' ');
  const rows = Array.isArray(items) ? items : [];

  return (
    <div className={tableClassName} role="table" aria-label={ariaLabel}>
      <div className="invoice-items-row invoice-items-row-header" role="row">
        <div className="invoice-items-cell" role="columnheader">
          {labels.item || 'Item'}
        </div>
        <div className="invoice-items-cell invoice-items-cell-right" role="columnheader">
          {labels.qty || 'Qty'}
        </div>
        <div className="invoice-items-cell invoice-items-cell-right" role="columnheader">
          {labels.rate || 'Rate'}
        </div>
        <div className="invoice-items-cell invoice-items-cell-right" role="columnheader">
          {labels.amount || 'Amount'}
        </div>
      </div>

      {rows.map((item, index) => {
        const key = item?.id || `${index}-${item?.name || 'item'}`;
        const name = getCellText(item?.name);
        const description = item?.description ? String(item.description).trim() : '';

        return (
          <div className="invoice-items-row" role="row" key={key}>
            <div className="invoice-items-cell" role="cell">
              <div className="invoice-items-name" title={String(name)}>
                {name}
              </div>
              {description ? (
                <div className="invoice-items-desc" title={description}>
                  {description}
                </div>
              ) : null}
            </div>

            <div className="invoice-items-cell invoice-items-cell-right" role="cell">
              {getCellText(item?.qty, '0')}
            </div>
            <div className="invoice-items-cell invoice-items-cell-right" role="cell">
              {getCellText(item?.rate, '0')}
            </div>
            <div className="invoice-items-cell invoice-items-cell-right" role="cell">
              {getCellText(item?.amount, '0')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default InvoiceItemsTable;
