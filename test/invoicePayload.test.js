import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInvoiceMutationInput, LINE_ITEM_DISCOUNT_TYPE } from '../src/lib/invoicePayload.js';

test('buildInvoiceMutationInput sends line discount as amount discount type', () => {
  const payload = buildInvoiceMutationInput({
    invoice: {
      customerId: '42',
      paymentTerms: 'DueOnReceipt',
      currentStatus: 'Draft',
      lines: [
        {
          name: 'Roblox',
          qty: '1',
          rate: '6000',
          discount: '1000'
        }
      ]
    },
    branchId: 1,
    warehouseId: 2,
    currencyId: 3,
    invoiceDateIso: '2026-02-17T00:00:00.000Z'
  });

  assert.equal(payload.customerId, 42);
  assert.equal(payload.details.length, 1);
  assert.deepEqual(payload.details[0], {
    name: 'Roblox',
    detailQty: 1,
    detailUnitRate: 6000,
    detailDiscount: 1000,
    detailDiscountType: LINE_ITEM_DISCOUNT_TYPE
  });
});

test('buildInvoiceMutationInput preserves percentage discount type when provided', () => {
  const payload = buildInvoiceMutationInput({
    invoice: {
      customerId: 7,
      paymentTerms: 'DueOnReceipt',
      lines: [
        {
          name: 'Item A',
          qty: 2,
          rate: 500,
          discount: 10,
          discountType: 'P'
        }
      ]
    },
    branchId: 1,
    warehouseId: 2,
    currencyId: 3,
    invoiceDateIso: '2026-02-17T00:00:00.000Z'
  });

  assert.equal(payload.details[0].detailDiscountType, 'P');
});
