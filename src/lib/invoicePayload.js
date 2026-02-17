export const LINE_ITEM_DISCOUNT_TYPE = 'A';
const PERCENT_DISCOUNT_TYPE = 'P';

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function normalizeDiscountType(value) {
  if (value === PERCENT_DISCOUNT_TYPE) return PERCENT_DISCOUNT_TYPE;
  return LINE_ITEM_DISCOUNT_TYPE;
}

export function buildInvoiceMutationInput({
  invoice,
  branchId,
  warehouseId,
  currencyId,
  invoiceDateIso
}) {
  return {
    customerId: toNumber(invoice?.customerId),
    branchId,
    warehouseId,
    currencyId,
    invoiceDate: invoiceDateIso,
    invoicePaymentTerms: invoice?.paymentTerms,
    currentStatus: invoice?.currentStatus || 'Draft',
    referenceNumber: invoice?.referenceNumber || undefined,
    isTaxInclusive: false,
    details: (invoice?.lines || []).map((line) => ({
      name: line?.name || '',
      detailQty: toNumber(line?.qty),
      detailUnitRate: toNumber(line?.rate),
      detailDiscount: toNumber(line?.discount),
      detailDiscountType: normalizeDiscountType(line?.discountType)
    }))
  };
}
