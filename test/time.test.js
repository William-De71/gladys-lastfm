import { test } from 'node:test';
import assert from 'node:assert/strict';

import { startOfDay, formatDateTime, gladysTimeZone } from '../src/time.js';

test('finds the last local midnight', () => {
  assert.equal(
    startOfDay(Date.parse('2026-10-11T10:00:00Z'), 'Europe/Paris'),
    Date.parse('2026-10-10T22:00:00Z'),
  );
  assert.equal(
    startOfDay(Date.parse('2026-10-11T03:00:00Z'), 'America/New_York'),
    Date.parse('2026-10-10T04:00:00Z'),
  );
  assert.equal(
    startOfDay(Date.parse('2026-10-11T00:00:00Z'), 'UTC'),
    Date.parse('2026-10-11T00:00:00Z'),
  );
});

test('handles the days of a DST change', () => {
  // Paris switches to winter time on 2026-10-25 at 03:00 (+2 -> +1).
  assert.equal(
    startOfDay(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Paris'),
    Date.parse('2026-10-24T22:00:00Z'),
  );
  assert.equal(
    startOfDay(Date.parse('2026-10-26T12:00:00Z'), 'Europe/Paris'),
    Date.parse('2026-10-25T23:00:00Z'),
  );
  // And to summer time on 2026-03-29 (+1 -> +2).
  assert.equal(
    startOfDay(Date.parse('2026-03-29T12:00:00Z'), 'Europe/Paris'),
    Date.parse('2026-03-28T23:00:00Z'),
  );
});

test('formats a local date and time', () => {
  assert.equal(
    formatDateTime(Date.parse('2026-10-11T12:05:00Z'), 'fr', 'Europe/Paris'),
    '11/10/2026 14:05',
  );
});

test('reads the time zone of Gladys from TZ', () => {
  const saved = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Paris';
    assert.equal(gladysTimeZone(), 'Europe/Paris');
    process.env.TZ = 'Not/AZone';
    assert.equal(gladysTimeZone(), 'UTC');
  } finally {
    if (saved === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = saved;
    }
  }
});
