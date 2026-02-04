export function formatInvoiceNumberShort(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  const isDraft = /^draft\b/i.test(raw);
  if (!isDraft) return raw;

  const remainder = raw.replace(/^draft[\s-]*/i, '');
  if (!remainder) return 'DRAFT';

  const alreadyShort = remainder.match(/[0-9a-fA-F]{4}-[0-9a-fA-F]{4}/);
  if (alreadyShort) {
    return `DRAFT-${alreadyShort[0].toUpperCase()}`;
  }

  const hex8 = remainder.match(/[0-9a-fA-F]{8}/);
  if (hex8) {
    const hex = hex8[0].toUpperCase();
    return `DRAFT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
  }

  return `DRAFT-${remainder}`;
}

export function formatPaymentTerms(value) {
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

export function formatShortDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function computeDueDate(value, terms) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const days = terms === 'Net7' ? 7 : terms === 'Net15' ? 15 : terms === 'Net30' ? 30 : 0;
  if (!days) return date;

  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatMoney(amount, currency) {
  const number = Number(amount);
  const safe = Number.isFinite(number) ? number : 0;
  const formatted = safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const prefix = (currency?.symbol || currency?.name || '').trim();
  if (!prefix) return `$${formatted}`;

  const needsSpace = prefix.length > 1 && !/[$€£¥]/.test(prefix);
  return needsSpace ? `${prefix} ${formatted}` : `${prefix}${formatted}`;
}

