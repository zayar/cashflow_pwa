import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TELEGRAM_FEATURE_INVENTORY_SUMMARY,
  TELEGRAM_FEATURE_LOW_INVENTORY,
  TELEGRAM_FEATURE_TODAY_REPORT,
  TELEGRAM_FEATURE_WEEKLY_REPORT,
  TELEGRAM_FEATURE_YESTERDAY_REPORT,
  getTelegramAllowedFeatures,
  getTelegramFeatureFromReportCode,
  isPro,
  isTelegramFeatureAllowed,
  isTelegramReportCodeAllowed
} from '../src/lib/telegramFeatures.js';

test('isPro normalizes plan values', () => {
  assert.equal(isPro('PRO'), true);
  assert.equal(isPro('pro'), true);
  assert.equal(isPro('LITE'), false);
});

test('getTelegramAllowedFeatures follows plan rules', () => {
  assert.deepEqual(getTelegramAllowedFeatures('LITE'), [
    TELEGRAM_FEATURE_TODAY_REPORT,
    TELEGRAM_FEATURE_YESTERDAY_REPORT,
    TELEGRAM_FEATURE_WEEKLY_REPORT
  ]);
  assert.deepEqual(getTelegramAllowedFeatures('PRO'), ['*']);
});

test('isTelegramFeatureAllowed blocks inventory features for LITE', () => {
  assert.equal(isTelegramFeatureAllowed('LITE', TELEGRAM_FEATURE_TODAY_REPORT), true);
  assert.equal(isTelegramFeatureAllowed('LITE', TELEGRAM_FEATURE_WEEKLY_REPORT), true);
  assert.equal(isTelegramFeatureAllowed('LITE', TELEGRAM_FEATURE_INVENTORY_SUMMARY), false);
  assert.equal(isTelegramFeatureAllowed('LITE', TELEGRAM_FEATURE_LOW_INVENTORY), false);
});

test('getTelegramFeatureFromReportCode resolves known report codes', () => {
  assert.equal(getTelegramFeatureFromReportCode('TODAY_REPORT'), TELEGRAM_FEATURE_TODAY_REPORT);
  assert.equal(getTelegramFeatureFromReportCode('LOW_INVENTORY_SUMMARY'), TELEGRAM_FEATURE_LOW_INVENTORY);
  assert.equal(getTelegramFeatureFromReportCode('UNKNOWN'), '');
});

test('isTelegramReportCodeAllowed enforces advanced reports for PRO only', () => {
  assert.equal(isTelegramReportCodeAllowed('LITE', 'TODAY_REPORT'), true);
  assert.equal(isTelegramReportCodeAllowed('LITE', 'INVENTORY_SUMMARY'), false);
  assert.equal(isTelegramReportCodeAllowed('PRO', 'LOW_INVENTORY_SUMMARY'), true);
});
