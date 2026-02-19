import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInvoiceShareUrl } from '../src/lib/shareApi.js';

const withWindowLocation = (urlString, run) => {
  const previousWindow = globalThis.window;
  const url = new URL(urlString);

  globalThis.window = {
    location: {
      origin: url.origin,
      hostname: url.hostname
    }
  };

  try {
    run();
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
};

test('buildInvoiceShareUrl maps known PWA hosts to canonical public viewer origin', () => {
  const token = 'abc123';

  withWindowLocation('https://pwa-invoice.web.app', () => {
    const url = buildInvoiceShareUrl(token, { lang: 'my' });
    assert.equal(url, 'https://cashflow-483906.web.app/#/public/invoices/abc123?lang=my');
  });

  withWindowLocation('https://invoice.cashfloweasy.app', () => {
    const url = buildInvoiceShareUrl(token, { lang: 'my' });
    assert.equal(url, 'https://cashflow-483906.web.app/#/public/invoices/abc123?lang=my');
  });
});

test('buildInvoiceShareUrl falls back to current origin for unknown hosts', () => {
  withWindowLocation('https://staging.example.com', () => {
    const url = buildInvoiceShareUrl('abc123', { lang: 'my' });
    assert.equal(url, 'https://staging.example.com/#/public/invoices/abc123?lang=my');
  });
});

test('buildInvoiceShareUrl omits lang query for en and empty lang', () => {
  withWindowLocation('https://invoice.cashfloweasy.app', () => {
    assert.equal(
      buildInvoiceShareUrl('abc123', { lang: 'en' }),
      'https://cashflow-483906.web.app/#/public/invoices/abc123'
    );
    assert.equal(
      buildInvoiceShareUrl('abc123', {}),
      'https://cashflow-483906.web.app/#/public/invoices/abc123'
    );
  });
});
