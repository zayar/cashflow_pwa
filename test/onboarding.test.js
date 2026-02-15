import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCompanyBasicsPayload,
  deriveTelegramStatus,
  ensureDefaultInvoiceTemplate,
  formatTelegramCommand,
  shouldShowOnboarding
} from '../src/lib/onboardingFlow.js';

test('shouldShowOnboarding flags missing required fields', () => {
  const missingPhone = { businessName: 'Acme Co', phone: '' };
  const complete = { businessName: 'Acme Co', phone: '123' };

  assert.equal(shouldShowOnboarding(missingPhone), true);
  assert.equal(shouldShowOnboarding(complete), false);
});

test('buildCompanyBasicsPayload trims inputs', () => {
  const payload = buildCompanyBasicsPayload({
    businessName: '  Acme  ',
    phone: ' 123 ',
    address: ' Main St ',
    city: ' Yangon ',
    logoUrl: ' logo.png '
  });
  assert.deepEqual(payload, {
    businessName: 'Acme',
    phone: '123',
    address: 'Main St',
    city: 'Yangon',
    logoUrl: 'logo.png'
  });
});

test('formatTelegramCommand enforces /link prefix', () => {
  assert.equal(formatTelegramCommand('123456'), '/link 123456');
  assert.equal(formatTelegramCommand('/link 999999'), '/link 999999');
});

test('deriveTelegramStatus captures link state', () => {
  const linked = deriveTelegramStatus({ telegramLinked: true, linkedRecipientsCount: 2 });
  const pending = deriveTelegramStatus({ telegramLinked: false, linkedRecipientsCount: 0 });
  assert.equal(linked.linked, true);
  assert.equal(linked.linkedRecipients, 2);
  assert.equal(pending.linked, false);
});

test('ensureDefaultInvoiceTemplate reuses existing default', async () => {
  const existingDefault = { id: 10, is_default: true };
  const result = await ensureDefaultInvoiceTemplate({
    businessId: 'biz-1',
    fetchDefault: async () => existingDefault,
    listFn: async () => {
      throw new Error('list should not be called when default exists');
    }
  });
  assert.equal(result.created, false);
  assert.equal(result.template, existingDefault);
});

test('ensureDefaultInvoiceTemplate promotes existing template when no default', async () => {
  const list = [{ id: 20, is_default: false }];
  const promoted = { id: 20, is_default: true };
  const result = await ensureDefaultInvoiceTemplate({
    businessId: 'biz-2',
    fetchDefault: async () => null,
    listFn: async () => list,
    setDefaultFn: async () => promoted
  });
  assert.equal(result.created, false);
  assert.equal(result.template.id, 20);
  assert.equal(result.template.is_default, true);
});

test('ensureDefaultInvoiceTemplate creates when none exist', async () => {
  const created = { id: 30, is_default: true };
  const result = await ensureDefaultInvoiceTemplate({
    businessId: 'biz-3',
    fetchDefault: async () => null,
    listFn: async () => [],
    createFn: async () => created
  });
  assert.equal(result.created, true);
  assert.equal(result.template, created);
});
