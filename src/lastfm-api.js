// -----------------------------------------------------------------------------
// Client of the Last.fm API (https://www.last.fm/api).
//
// One endpoint, `https://ws.audioscrobbler.com/2.0/`, the method in the query
// string, `format=json`. Two kinds of calls:
//   - read calls (recent tracks, charts, profile): the API key alone;
//   - signed calls (auth.getToken, auth.getSession, track.love…): an
//     `api_sig` = md5 of the parameters sorted by name, each name glued to its
//     value, followed by the shared secret. Write calls are POSTed and carry
//     the session key (`sk`) of the linked account.
//
// Last.fm reports its errors as `{ error: <code>, message }`, with an HTTP
// status that is sometimes 200, sometimes 4xx: the body is the authority.
// Codes 8 (operation failed), 11 (service offline), 16 (temporary error), 29
// (rate limit), a 5xx and a network failure are retried once.
//
// Images: Last.fm serves its covers from lastfm.freetls.fastly.net. The image
// handler only fetches URLs rebuilt by images.js from a validated hash.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

const API_URL = 'https://ws.audioscrobbler.com/2.0/';
const AUTH_URL = 'https://www.last.fm/api/auth/';
const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 1500;
const MAX_IMAGE_BYTES = 300 * 1024;

const ERROR_CODES = {
  AUTH_FAILED: 4,
  INVALID_PARAMETERS: 6,
  OPERATION_FAILED: 8,
  INVALID_SESSION: 9,
  INVALID_API_KEY: 10,
  SERVICE_OFFLINE: 11,
  INVALID_SIGNATURE: 13,
  UNAUTHORIZED_TOKEN: 14,
  TOKEN_EXPIRED: 15,
  TEMPORARY_ERROR: 16,
  LOGIN_REQUIRED: 17,
  SUSPENDED_API_KEY: 26,
  RATE_LIMIT: 29,
};

const RETRIED_CODES = new Set([
  ERROR_CODES.OPERATION_FAILED,
  ERROR_CODES.SERVICE_OFFLINE,
  ERROR_CODES.TEMPORARY_ERROR,
  ERROR_CODES.RATE_LIMIT,
]);

// Errors that mean "the configuration is wrong", not "try again later".
const CONFIG_ERROR_CODES = new Set([
  ERROR_CODES.INVALID_API_KEY,
  ERROR_CODES.SUSPENDED_API_KEY,
  ERROR_CODES.INVALID_SIGNATURE,
]);

/**
 * @description Error of a Last.fm call, carrying the Last.fm error code (0 when
 * the failure is not a Last.fm answer) and the HTTP status (0 for a network
 * failure).
 */
class LastfmError extends Error {
  /**
   * @param {string} message - The message.
   * @param {object} [details] - Details.
   * @param {number} [details.code] - The Last.fm error code.
   * @param {number} [details.status] - The HTTP status.
   */
  constructor(message, { code = 0, status = 0 } = {}) {
    super(message);
    this.name = 'LastfmError';
    this.code = code;
    this.status = status;
  }
}

/**
 * @description Compute the signature of a call.
 * @param {object} params - The call parameters (without `format`/`callback`).
 * @param {string} secret - The shared secret.
 * @returns {string} The md5 signature, 32 hex characters.
 * @example
 * sign({ api_key: 'k', method: 'auth.getSession', token: 't' }, 's');
 */
function sign(params, secret) {
  const base = Object.keys(params)
    .filter((key) => key !== 'format' && key !== 'callback')
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');
  return createHash('md5')
    .update(base + secret, 'utf8')
    .digest('hex');
}

/**
 * @description Build the User-Agent Last.fm asks for: the product and its URL.
 * @param {object} options - Options.
 * @param {string} options.name - The package name.
 * @param {string} options.version - The integration version.
 * @param {string} [options.homepage] - The project URL.
 * @returns {string} The User-Agent header.
 * @example
 * buildUserAgent({ name: 'gladys-lastfm', version: '0.1.0', homepage: 'https://github.com/William-De71/gladys-lastfm' });
 */
function buildUserAgent({ name, version, homepage = '' }) {
  return homepage ? `${name}/${version} (+${homepage})` : `${name}/${version}`;
}

/**
 * @description Read the image type from its first bytes.
 * @param {Buffer} buffer - The bytes.
 * @returns {string|null} 'png', 'jpeg', 'webp' or null for anything else.
 * @example
 * imageType(Buffer.from([0xff, 0xd8, 0xff])); // -> 'jpeg'
 */
function imageType(buffer) {
  if (buffer.length >= 8 && buffer.readUInt32BE(0) === 0x89504e47) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * @description Create the Last.fm client.
 * @param {object} options - Options.
 * @param {Function} options.getCredentials - `() => ({ apiKey, sharedSecret })`,
 * read on every call (the user can change them at any time).
 * @param {Function} options.getUserAgent - `() => string`.
 * @param {Function} [options.fetchImpl] - fetch implementation (for the tests).
 * @param {Function} [options.sleep] - `(ms) => Promise` (for the tests).
 * @returns {object} The client.
 * @example
 * const lastfm = createLastfmClient({ getCredentials: () => creds, getUserAgent: () => ua });
 */
function createLastfmClient({
  getCredentials,
  getUserAgent,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  /**
   * @description Send one request and decode the Last.fm answer.
   * @param {string} url - The URL.
   * @param {object} init - fetch options.
   * @param {string} method - The Last.fm method, for the messages.
   * @returns {Promise<object>} The decoded body.
   * @throws {LastfmError} On an error answer.
   */
  async function send(url, init, method) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        headers: { 'User-Agent': getUserAgent(), Accept: 'application/json', ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new LastfmError(`Last.fm ${method} failed: ${err.message}`);
    }
    // A non-JSON body (an HTML error page of a proxy) reads as null.
    const body = await response.json().catch(() => null);
    if (body && typeof body.error === 'number') {
      throw new LastfmError(`Last.fm ${method}: ${body.message || 'error'} (code ${body.error})`, {
        code: body.error,
        status: response.status,
      });
    }
    if (!response.ok || body === null) {
      throw new LastfmError(`Last.fm ${method}: HTTP ${response.status}`, {
        status: response.status,
      });
    }
    return body;
  }

  /**
   * @description Call a method, retried once on a transient failure.
   * @param {string} method - The Last.fm method, e.g. 'user.getRecentTracks'.
   * @param {object} [params] - Its parameters (undefined/null/'' dropped).
   * @param {object} [options] - Options.
   * @param {boolean} [options.signed] - Sign the call with the shared secret.
   * @param {boolean} [options.post] - Send it as a POST (write calls).
   * @returns {Promise<object>} The decoded body.
   * @throws {LastfmError} On an error answer, or without credentials.
   */
  async function call(method, params = {}, { signed = false, post = false } = {}) {
    const { apiKey, sharedSecret } = getCredentials();
    if (!apiKey) {
      throw new LastfmError('No Last.fm API key configured', {
        code: ERROR_CODES.INVALID_API_KEY,
      });
    }
    if (signed && !sharedSecret) {
      throw new LastfmError('No Last.fm shared secret configured', {
        code: ERROR_CODES.INVALID_SIGNATURE,
      });
    }
    const query = { method, api_key: apiKey };
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query[key] = String(value);
      }
    });
    if (signed) {
      query.api_sig = sign(query, sharedSecret);
    }
    query.format = 'json';
    const encoded = new URLSearchParams(query).toString();

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS);
      }
      try {
        return post
          ? await send(
              API_URL,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: encoded,
              },
              method,
            )
          : await send(`${API_URL}?${encoded}`, { method: 'GET' }, method);
      } catch (err) {
        lastError = err;
        const transient =
          err.code === 0 ? err.status === 0 || err.status >= 500 : RETRIED_CODES.has(err.code);
        if (!transient) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  return {
    call,

    /**
     * @description The latest scrobbles of a user, the track playing now first
     * (flagged `@attr.nowplaying`).
     * @param {string} user - The username.
     * @param {object} [options] - { limit (1-200), from (unix s), extended }.
     * @returns {Promise<object>} The `recenttracks` object.
     */
    async getRecentTracks(user, { limit = 10, from, extended = true } = {}) {
      const body = await call('user.getRecentTracks', {
        user,
        limit,
        from,
        extended: extended ? 1 : 0,
      });
      return body.recenttracks ?? {};
    },

    /**
     * @description The profile of a user (canonical name, total scrobbles…).
     * @param {string} user - The username.
     * @returns {Promise<object>} The `user` object.
     */
    async getUserInfo(user) {
      const body = await call('user.getInfo', { user });
      return body.user ?? {};
    },

    /**
     * @description The latest loved tracks of a user.
     * @param {string} user - The username.
     * @param {number} [limit] - How many.
     * @returns {Promise<object>} The `lovedtracks` object.
     */
    async getLovedTracks(user, limit = 5) {
      const body = await call('user.getLovedTracks', { user, limit });
      return body.lovedtracks ?? {};
    },

    /**
     * @description A chart of a user over a period.
     * @param {string} user - The username.
     * @param {string} kind - 'artists' | 'albums' | 'tracks'.
     * @param {string} period - overall | 7day | 1month | 3month | 6month | 12month.
     * @param {number} limit - How many entries.
     * @returns {Promise<object[]>} The raw entries, best first.
     */
    async getTop(user, kind, period, limit) {
      const methods = {
        artists: ['user.getTopArtists', 'topartists', 'artist'],
        albums: ['user.getTopAlbums', 'topalbums', 'album'],
        tracks: ['user.getTopTracks', 'toptracks', 'track'],
      };
      const [method, root, entry] = methods[kind] ?? methods.artists;
      const body = await call(method, { user, period, limit });
      const list = body[root]?.[entry] ?? [];
      return Array.isArray(list) ? list : [list];
    },

    /**
     * @description Ask Last.fm for a request token (desktop authentication).
     * @returns {Promise<string>} The token, valid 60 minutes, usable once.
     */
    async getToken() {
      const body = await call('auth.getToken', {}, { signed: true });
      if (typeof body.token !== 'string' || body.token === '') {
        throw new LastfmError('Last.fm auth.getToken: no token in the answer');
      }
      return body.token;
    },

    /**
     * @description Exchange an authorized request token for a session.
     * @param {string} token - The request token.
     * @returns {Promise<{ name: string, key: string }>} The session (the key
     * does not expire until the user revokes it).
     * @throws {LastfmError} Code 14 while the user has not approved yet.
     */
    async getSession(token) {
      const body = await call('auth.getSession', { token }, { signed: true });
      const session = body.session ?? {};
      if (!session.key || !session.name) {
        throw new LastfmError('Last.fm auth.getSession: no session in the answer');
      }
      return { name: String(session.name), key: String(session.key) };
    },

    /**
     * @description The page the user approves the access on.
     * @param {string} token - The request token.
     * @returns {string} The URL.
     */
    authorizeUrl(token) {
      const { apiKey } = getCredentials();
      return `${AUTH_URL}?${new URLSearchParams({ api_key: apiKey, token })}`;
    },

    /**
     * @description Love or unlove a track as the linked account.
     * @param {object} options - Options.
     * @param {string} options.artist - The artist.
     * @param {string} options.track - The track.
     * @param {string} options.sessionKey - The session key.
     * @param {boolean} [options.love] - false to unlove.
     * @returns {Promise<void>}
     */
    async setLove({ artist, track, sessionKey, love = true }) {
      await call(
        love ? 'track.love' : 'track.unlove',
        { artist, track, sk: sessionKey },
        { signed: true, post: true },
      );
    },

    /**
     * @description Download a cover and check it is something the core serves.
     * @param {string} url - The image URL (built by images.js only).
     * @returns {Promise<string>} The raw base64.
     */
    async fetchImage(url) {
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { 'User-Agent': getUserAgent() },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new LastfmError(`Last.fm image failed: ${err.message}`);
      }
      if (!response.ok) {
        throw new LastfmError(`Last.fm image: HTTP ${response.status}`, {
          status: response.status,
        });
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new LastfmError(`Last.fm image too large (${buffer.length} bytes)`);
      }
      if (imageType(buffer) === null) {
        throw new LastfmError('Last.fm image is not a PNG, JPEG or WebP');
      }
      return buffer.toString('base64');
    },
  };
}

export {
  API_URL,
  ERROR_CODES,
  CONFIG_ERROR_CODES,
  LastfmError,
  sign,
  buildUserAgent,
  imageType,
  createLastfmClient,
};
