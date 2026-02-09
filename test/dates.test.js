import test from 'node:test';
import assert from 'node:assert/strict';

import { dateInputToISODateTime, dateInputToMyDateString, toDateInputValue } from '../src/lib/dates.js';

test('toDateInputValue returns stable YYYY-MM-DD for date input values', () => {
  assert.equal(toDateInputValue('2026-02-09'), '2026-02-09');
  assert.equal(toDateInputValue(''), '');
  assert.equal(toDateInputValue('not-a-date'), '');

  const constructed = new Date(2026, 1, 9, 0, 0, 0, 0); // local
  assert.equal(toDateInputValue(constructed), '2026-02-09');
});

test('dateInputToMyDateString formats backend MyDateString (YYYY-MM-DDTHH:mm:ss)', () => {
  assert.equal(dateInputToMyDateString('2026-02-09'), '2026-02-09T00:00:00');
  assert.equal(dateInputToMyDateString('2026-02-09T10:11:12Z'), '2026-02-09T00:00:00');
  assert.equal(dateInputToMyDateString('bad'), '');
});

test('dateInputToISODateTime produces RFC3339 for backend Time scalar and round-trips to the same local date', () => {
  const iso = dateInputToISODateTime('2026-02-09');
  assert.ok(iso.includes('T'), 'expected RFC3339 datetime');
  assert.ok(iso.endsWith('Z'), 'expected UTC (Z) serialization');
  assert.equal(toDateInputValue(iso), '2026-02-09');
});

