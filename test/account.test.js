import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAccountLinker } from '../src/account.js';
import { LastfmError, ERROR_CODES } from '../src/lastfm-api.js';
import { silent } from './helpers/fixtures.js';

/**
 * @description A Last.fm client whose getSession answers from a list.
 * @param {Array} sessions - Per call: a session or an error code.
 * @returns {object} The client, with `sessionCalls`.
 */
function fakeLastfm(sessions) {
  const client = {
    sessionCalls: 0,
    async getToken() {
      return 'tok';
    },
    authorizeUrl: (token) => `https://www.last.fm/api/auth/?api_key=k&token=${token}`,
    async getSession(token) {
      assert.equal(token, 'tok');
      const answer = sessions[Math.min(client.sessionCalls, sessions.length - 1)];
      client.sessionCalls += 1;
      if (typeof answer === 'number') {
        throw new LastfmError('nope', { code: answer });
      }
      return answer;
    },
  };
  return client;
}

/**
 * @description A linker with an instant clock.
 * @param {object} lastfm - The client.
 * @param {Array} linked - Receives the stored sessions.
 * @param {object} [options] - Options.
 * @returns {object} The linker.
 */
function linker(lastfm, linked, options = {}) {
  let clock = 0;
  return createAccountLinker({
    lastfm,
    onLinked: async (session) => linked.push(session),
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    pollMs: 3000,
    waitMs: 30000,
    logger: silent,
    ...options,
  });
}

test('returns the approval page, then stores the session once approved', async () => {
  const lastfm = fakeLastfm([
    ERROR_CODES.UNAUTHORIZED_TOKEN,
    ERROR_CODES.UNAUTHORIZED_TOKEN,
    { name: 'RJ', key: 'sk' },
  ]);
  const linked = [];
  const accounts = linker(lastfm, linked);
  assert.equal(await accounts.start(), 'https://www.last.fm/api/auth/?api_key=k&token=tok');
  assert.deepEqual(await accounts.waiting(), { name: 'RJ', key: 'sk' });
  assert.deepEqual(linked, [{ name: 'RJ', key: 'sk' }]);
  assert.equal(lastfm.sessionCalls, 3);
});

test('keeps waiting through a network hiccup', async () => {
  const linked = [];
  const accounts = linker(fakeLastfm([0, { name: 'RJ', key: 'sk' }]), linked);
  await accounts.start();
  await accounts.waiting();
  assert.equal(linked.length, 1);
});

test('gives up on an expired token', async () => {
  const lastfm = fakeLastfm([ERROR_CODES.TOKEN_EXPIRED]);
  const linked = [];
  const accounts = linker(lastfm, linked);
  await accounts.start();
  assert.equal(await accounts.waiting(), null);
  assert.equal(lastfm.sessionCalls, 1);
  assert.deepEqual(linked, []);
});

test('gives up when nobody approves in time', async () => {
  const lastfm = fakeLastfm([ERROR_CODES.UNAUTHORIZED_TOKEN]);
  const accounts = linker(lastfm, []);
  await accounts.start();
  assert.equal(await accounts.waiting(), null);
  assert.equal(lastfm.sessionCalls, 10);
});

test('a new start or a cancel stops the previous wait', async () => {
  const lastfm = fakeLastfm([ERROR_CODES.UNAUTHORIZED_TOKEN]);
  const linked = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const accounts = linker(lastfm, linked, { sleep: () => gate });
  await accounts.start();
  const first = accounts.waiting();
  accounts.cancel();
  release();
  assert.equal(await first, null);
  assert.equal(lastfm.sessionCalls, 0);
});

test('fails the start when Last.fm refuses the token', async () => {
  const lastfm = {
    async getToken() {
      throw new LastfmError('Invalid API key', { code: ERROR_CODES.INVALID_API_KEY });
    },
  };
  await assert.rejects(linker(lastfm, []).start(), /Invalid API key/);
});
