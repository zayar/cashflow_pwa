export function getInvoiceStatusKey(rawStatus) {
  const normalized = String(rawStatus || '')
    .trim()
    .toLowerCase();

  if (!normalized) return null;

  // Keep this mapping intentionally fuzzy. Backend status strings can vary
  // (e.g. "Partially Paid", "Paid", "Overdue"), but UI should be localized.
  if (normalized.includes('draft')) return 'status.draft';
  if (normalized.includes('overdue')) return 'status.overdue';
  if (normalized.includes('partial')) return 'status.partialPaid';
  if (normalized.includes('paid')) return 'status.paid';
  if (normalized.includes('due') || normalized.includes('unpaid')) return 'status.due';
  if (normalized.includes('confirm')) return 'status.confirmed';
  if (normalized.includes('void') || normalized.includes('cancel')) return 'status.void';

  return null;
}

