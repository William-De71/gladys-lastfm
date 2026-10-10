import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  createLastfmClient,
  sign,
  buildUserAgent,
  imageType,
  ERROR_CODES,
  API_URL,
} from '../src/lastfm-api.js';

const KEY = '0123456789abcdef0123456789abcdef';

/**
 * @description A fake fetch answering from a list of replies, recording the calls.
 * @param {Array} replies - Per call: body | { status, body } | Error.
 * @returns {Function} The fetch, with a `calls` array.
 */
function fakeFetch(replies) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) {
      throw reply;
    }
    if (reply instanceof Uint8Array) {
      return new Response(reply, { status: 200 });
    }
    const { status = 200, body = reply } = reply?.__status ? reply : { body: reply };
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const reply = (status, body) => ({ __status: true, status, body });

/**
 * @description A client on a fake fetch.
 * @param {Array} replies - The replies.
 * @param {object} [credentials] - The credentials.
 * @returns {{ lastfm: object, fetchImpl: Function }} The client.
 */
function client(replies, credentials = { apiKey: KEY, sharedSecret: 'secret' }) {
  const fetchImpl = fakeFetch(replies);
  const lastfm = createLastfmClient({
    getCredentials: () => credentials,
    getUserAgent: () => 'gladys-lastfm/test',
    fetchImpl,
    sleep: async () => {},
  });
  return { lastfm, fetchImpl };
}

test('signs as Last.fm documents it: sorted, glued, secret appended, md5', () => {
  const expected = createHash('md5')
    .update('api_keykmethodauth.getSessiontokentmysecret')
    .digest('hex');
  assert.equal(
    sign({ token: 't', method: 'auth.getSession', api_key: 'k', format: 'json' }, 'mysecret'),
    expected,
  );
});

test('signs UTF-8 values', () => {
  const expected = createHash('md5').update('artistBjörkmysecret', 'utf8').digest('hex');
  assert.equal(sign({ artist: 'Björk' }, 'mysecret'), expected);
});

test('builds the User-Agent', () => {
  assert.equal(
    buildUserAgent({ name: 'gladys-lastfm', version: '0.1.0', homepage: 'https://x.y' }),
    'gladys-lastfm/0.1.0 (+https://x.y)',
  );
  assert.equal(buildUserAgent({ name: 'gladys-lastfm', version: '0.1.0' }), 'gladys-lastfm/0.1.0');
});

test('reads the recent tracks with the right query', async () => {
  const { lastfm, fetchImpl } = client([{ recenttracks: { track: [] } }]);
  const recent = await lastfm.getRecentTracks('rj', {
    limit: 1,
    from: 1700000000,
    extended: false,
  });
  assert.deepEqual(recent, { track: [] });
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.origin + url.pathname, API_URL);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    method: 'user.getRecentTracks',
    api_key: KEY,
    user: 'rj',
    limit: '1',
    from: '1700000000',
    extended: '0',
    format: 'json',
  });
  assert.equal(fetchImpl.calls[0].options.headers['User-Agent'], 'gladys-lastfm/test');
});

test('decodes a Last.fm error, even with an HTTP 200', async () => {
  const { lastfm } = client([{ error: 6, message: 'User not found' }]);
  await assert.rejects(lastfm.getUserInfo('nobody'), (err) => {
    assert.equal(err.name, 'LastfmError');
    assert.equal(err.code, ERROR_CODES.INVALID_PARAMETERS);
    assert.match(err.message, /User not found/);
    return true;
  });
});

test('does not retry a definitive error', async () => {
  const { lastfm, fetchImpl } = client([reply(403, { error: 10, message: 'Invalid API key' })]);
  await assert.rejects(lastfm.getUserInfo('rj'), {
    code: ERROR_CODES.INVALID_API_KEY,
    status: 403,
  });
  assert.equal(fetchImpl.calls.length, 1);
});

test('retries once a transient error, a 5xx or a network failure', async () => {
  for (const first of [
    { error: 29, message: 'Rate limit exceeded' },
    reply(503, 'Service Unavailable'),
    new Error('ECONNRESET'),
  ]) {
    const { lastfm, fetchImpl } = client([first, { user: { name: 'RJ' } }]);
    assert.deepEqual(await lastfm.getUserInfo('rj'), { name: 'RJ' });
    assert.equal(fetchImpl.calls.length, 2);
  }
});

test('gives up after the retry', async () => {
  const { lastfm, fetchImpl } = client([reply(500, 'oops')]);
  await assert.rejects(lastfm.getUserInfo('rj'), { status: 500 });
  assert.equal(fetchImpl.calls.length, 2);
});

test('refuses to call without an API key, or to sign without a secret', async () => {
  const noKey = client([{}], { apiKey: '', sharedSecret: '' });
  await assert.rejects(noKey.lastfm.getUserInfo('rj'), { code: ERROR_CODES.INVALID_API_KEY });
  assert.equal(noKey.fetchImpl.calls.length, 0);
  const noSecret = client([{}], { apiKey: KEY, sharedSecret: '' });
  await assert.rejects(noSecret.lastfm.getToken(), { code: ERROR_CODES.INVALID_SIGNATURE });
});

test('gets a token with a signed GET and builds the approval page', async () => {
  const { lastfm, fetchImpl } = client([{ token: 'tok123' }]);
  assert.equal(await lastfm.getToken(), 'tok123');
  const params = Object.fromEntries(new URL(fetchImpl.calls[0].url).searchParams);
  assert.equal(params.api_sig, sign({ method: 'auth.getToken', api_key: KEY }, 'secret'));
  assert.equal(
    lastfm.authorizeUrl('tok123'),
    `https://www.last.fm/api/auth/?api_key=${KEY}&token=tok123`,
  );
});

test('exchanges a token for a session', async () => {
  const { lastfm } = client([{ session: { name: 'RJ', key: 'sk', subscriber: 0 } }]);
  assert.deepEqual(await lastfm.getSession('tok'), { name: 'RJ', key: 'sk' });
});

test('loves a track with a signed POST carrying the session key', async () => {
  const { lastfm, fetchImpl } = client([{}]);
  await lastfm.setLove({ artist: 'Björk', track: 'Jóga', sessionKey: 'sk' });
  const { url, options } = fetchImpl.calls[0];
  assert.equal(url, API_URL);
  assert.equal(options.method, 'POST');
  const body = Object.fromEntries(new URLSearchParams(options.body));
  const { api_sig: signature, format, ...signed } = body;
  assert.equal(format, 'json');
  assert.equal(signed.method, 'track.love');
  assert.equal(signed.sk, 'sk');
  assert.equal(signature, sign(signed, 'secret'));
});

test('unloves with track.unlove', async () => {
  const { lastfm, fetchImpl } = client([{}]);
  await lastfm.setLove({ artist: 'a', track: 'b', sessionKey: 'sk', love: false });
  assert.equal(new URLSearchParams(fetchImpl.calls[0].options.body).get('method'), 'track.unlove');
});

test('reads a chart, a single entry included', async () => {
  const { lastfm } = client([{ topalbums: { album: { name: 'Discovery', playcount: '42' } } }]);
  assert.deepEqual(await lastfm.getTop('rj', 'albums', '7day', 1), [
    { name: 'Discovery', playcount: '42' },
  ]);
});

test('recognizes the image types the core serves', () => {
  assert.equal(imageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(imageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(imageType(Buffer.from('RIFF0000WEBPVP8 ', 'ascii')), 'webp');
  assert.equal(imageType(Buffer.from('GIF89a', 'ascii')), null);
});

test('downloads a cover as raw base64, refusing anything else', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const ok = client([jpeg]);
  assert.equal(await ok.lastfm.fetchImage('https://x/y.jpg'), Buffer.from(jpeg).toString('base64'));
  const gif = client([new Uint8Array(Buffer.from('GIF89a....'))]);
  await assert.rejects(gif.lastfm.fetchImage('https://x/y.gif'), /not a PNG/);
  const big = new Uint8Array(301 * 1024);
  big.set([0xff, 0xd8, 0xff]);
  await assert.rejects(client([big]).lastfm.fetchImage('https://x/y.jpg'), /too large/);
  await assert.rejects(client([reply(404, 'nope')]).lastfm.fetchImage('https://x/y.jpg'), /404/);
});
