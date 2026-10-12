import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  parseUsernames,
  readLanguage,
  isLinkedUser,
  POLL_INTERVAL,
  MAX_USERS,
  AUTO_LANGUAGE,
} from '../src/config.js';

const KEY = '0123456789ABCDEF0123456789abcdef';

test('normalizes a complete config', () => {
  const config = normalizeConfig({
    api_key: ` ${KEY} `,
    shared_secret: ' s3cret ',
    usernames: 'rj, Bob',
    poll_interval: '60',
    language: 'de',
    session_key: 'sk',
    session_user: 'RJ',
  });
  assert.deepEqual(config, {
    apiKey: KEY.toLowerCase(),
    sharedSecret: 's3cret',
    usernames: ['rj', 'Bob'],
    pollInterval: 60,
    language: 'de',
    sessionKey: 'sk',
    sessionUser: 'RJ',
  });
});

test('defaults everything on an empty config', () => {
  assert.deepEqual(normalizeConfig(), {
    apiKey: '',
    sharedSecret: '',
    usernames: [],
    pollInterval: POLL_INTERVAL.default,
    language: AUTO_LANGUAGE,
    sessionKey: '',
    sessionUser: '',
  });
  assert.equal(normalizeConfig(null).pollInterval, POLL_INTERVAL.default);
});

test('drops an API key that cannot be one', () => {
  assert.equal(normalizeConfig({ api_key: 'not-a-key' }).apiKey, '');
});

test('bounds the poll interval', () => {
  assert.equal(normalizeConfig({ poll_interval: 1 }).pollInterval, POLL_INTERVAL.min);
  assert.equal(normalizeConfig({ poll_interval: 9999 }).pollInterval, POLL_INTERVAL.max);
  assert.equal(normalizeConfig({ poll_interval: '' }).pollInterval, POLL_INTERVAL.default);
  assert.equal(normalizeConfig({ poll_interval: 'abc' }).pollInterval, POLL_INTERVAL.default);
});

test('parses the usernames: separators, invalid names, duplicates, cap', () => {
  assert.deepEqual(parseUsernames('rj;  Bob\nalice , RJ'), ['rj', 'Bob', 'alice']);
  assert.deepEqual(parseUsernames('1abc, a, way_too_long_username, ok-name, b@d'), ['ok-name']);
  assert.deepEqual(parseUsernames(undefined), []);
  const many = Array.from({ length: 15 }, (_, i) => `user${i}`).join(',');
  assert.equal(parseUsernames(many).length, MAX_USERS);
});

test('reads the language setting, automatic unless a known language', () => {
  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.equal(normalizeConfig({ language }).language, language);
  }
  assert.equal(normalizeConfig({ language: 'auto' }).language, AUTO_LANGUAGE);
  assert.equal(normalizeConfig({ language: 'it' }).language, AUTO_LANGUAGE);
  assert.equal(normalizeConfig({}).language, AUTO_LANGUAGE);
});

test('reads the stored language', () => {
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, 'en'), 'en');
});

test('recognizes the linked user case-insensitively', () => {
  const config = normalizeConfig({ session_key: 'sk', session_user: 'RJ' });
  assert.equal(isLinkedUser(config, 'rj'), true);
  assert.equal(isLinkedUser(config, 'bob'), false);
  assert.equal(isLinkedUser(normalizeConfig({ session_user: 'RJ' }), 'rj'), false);
});
