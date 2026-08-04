// tests/rateLimiting.test.js
//
// The public booking integration suite raises the rate limits so a shared
// 127.0.0.1 bucket does not starve it. That leaves a gap: nothing there proves
// the limiter actually works. This suite closes it.
//
// Two halves:
//   1. The env fallback logic, tested directly — it is security-relevant and a
//      permissive fallback would silently disable throttling in production.
//   2. The limiter wired into the real route stack, with a low limit.
//
// Runs with no database on purpose: the limiter must fire before anything
// downstream, so what happens after it is irrelevant here.

process.env.JWT_SECRET = 'test-secret';
process.env.PUBLIC_WRITE_RATE_LIMIT = '3';
process.env.PUBLIC_READ_RATE_LIMIT = '5';
process.env.PUBLIC_STATUS_RATE_LIMIT = '1000';

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { limitFromEnv } = require('../helpers/rateLimitConfig');

// Without this, every downstream query queues for 10s waiting for a connection
// that never arrives, and the tests time out instead of asserting anything.
mongoose.set('bufferCommands', false);

jest.setTimeout(30000);

const app = express();
app.use('/api/v1/public', require('../routes/publicRoutes'));

afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
});

// --- fallback logic -------------------------------------------------------

describe('limitFromEnv', () => {
  const VAR = 'TEST_RATE_LIMIT_VAR';
  afterEach(() => { delete process.env[VAR]; });

  test('uses a valid override', () => {
    process.env[VAR] = '42';
    expect(limitFromEnv(VAR, 10)).toBe(42);
  });

  test.each([
    [undefined, 'unset'],
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['0', 'zero'],
    ['-5', 'negative'],
    ['abc', 'non-numeric'],
    ['null', 'the string "null"'],
    ['Infinity', 'Infinity'],
  ])('falls back to the STRICT default for %p (%s)', (value) => {
    // The failure mode this guards: a typo in a deploy config must never
    // remove throttling from a public endpoint.
    if (value === undefined) delete process.env[VAR];
    else process.env[VAR] = value;
    expect(limitFromEnv(VAR, 10)).toBe(10);
  });

  test('never returns zero, negative or non-integer', () => {
    for (const v of ['0', '-1', '1.5', 'abc', '']) {
      process.env[VAR] = v;
      const result = limitFromEnv(VAR, 10);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    }
  });
});

// --- limiter in the real route stack --------------------------------------

describe('public write rate limiting', () => {
  test('blocks after the configured number of booking attempts', async () => {
    const send = () => request(app)
      .post('/api/v1/public/any-slug/bookings')
      .set('Idempotency-Key', `k-${Math.random()}`)
      .send({ room_number: '101' });

    // The first 3 pass the limiter. They fail further down (no database), but
    // crucially they are NOT 429 — the limiter let them through.
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect((await send()).status).not.toBe(429);
    }

    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('public read rate limiting', () => {
  test('blocks after the configured number of reads', async () => {
    const send = () => request(app).get('/api/v1/public/any-slug/property');

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect((await send()).status).not.toBe(429);
    }

    expect((await send()).status).toBe(429);
  });
});
