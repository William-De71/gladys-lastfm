// -----------------------------------------------------------------------------
// Configuration of the Last.fm integration.
//
// Fields of the config_schema:
//   - `api_key`        the Last.fm API key (free, created in a minute on
//                      last.fm/api/account/create) — required for everything;
//   - `shared_secret`  the secret of that API account — only needed to link
//                      an account (signed calls: "love" a track);
//   - `usernames`      the Last.fm profiles to follow, separated by commas;
//   - `poll_interval`  how often the profiles are read, in seconds;
//   - `language`       language of the texts Gladys does not ask for in a
//                      language (device names, scene summaries): `auto`
//                      follows the language of the last widget request.
//
// Internal keys, outside the config_schema (never shown in the UI):
//   - `session_key` / `session_user`  the session of the linked account,
//                                     obtained through the `account` Connect
//                                     button (see account.js);
//   - `last_language`                 language of the last widget request,
//                                     for the device names and the scene texts
//                                     after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const POLL_INTERVAL = { min: 15, max: 300, default: 30 };
const MAX_USERS = 10;
// Last.fm usernames: 2 to 15 characters, a letter first, then letters, digits,
// "_" and "-". Anything else cannot be a profile and is dropped.
const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;
const API_KEY_REGEX = /^[0-9a-f]{32}$/i;
const AUTO_LANGUAGE = 'auto';

const INTERNAL_KEYS = {
  sessionKey: 'session_key',
  sessionUser: 'session_user',
  language: 'last_language',
};

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('60', POLL_INTERVAL); // -> 60
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read a trimmed string.
 * @param {unknown} raw - The raw value.
 * @returns {string} The string, '' when absent.
 * @example
 * readString(' abc '); // -> 'abc'
 */
function readString(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * @description Parse the usernames field: separated by commas, semicolons or
 * spaces, invalid names dropped, duplicates (case-insensitive, as on Last.fm)
 * removed, capped.
 * @param {unknown} raw - The raw field.
 * @returns {string[]} The usernames, as typed.
 * @example
 * parseUsernames('rj, Bob;rj'); // -> ['rj', 'Bob']
 */
function parseUsernames(raw) {
  const seen = new Set();
  const names = [];
  readString(raw)
    .split(/[\s,;]+/)
    .filter((name) => USERNAME_REGEX.test(name))
    .forEach((name) => {
      const key = name.toLowerCase();
      if (!seen.has(key) && names.length < MAX_USERS) {
        seen.add(key);
        names.push(name);
      }
    });
  return names;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ apiKey: string, sharedSecret: string, usernames: string[],
 * pollInterval: number, language: string, sessionKey: string,
 * sessionUser: string }} The config (poll interval in seconds, language 'auto'
 * or a language code).
 * @example
 * normalizeConfig({ api_key: '0123…', usernames: 'rj' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const apiKey = readString(config.api_key);
  return {
    apiKey: API_KEY_REGEX.test(apiKey) ? apiKey.toLowerCase() : '',
    sharedSecret: readString(config.shared_secret),
    usernames: parseUsernames(config.usernames),
    pollInterval: readNumber(config.poll_interval, POLL_INTERVAL),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
    sessionKey: readString(config[INTERNAL_KEYS.sessionKey]),
    sessionUser: readString(config[INTERNAL_KEYS.sessionUser]),
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

/**
 * @description Whether a username is the linked account (Last.fm usernames
 * are case-insensitive).
 * @param {object} config - The normalized config.
 * @param {string} username - The username.
 * @returns {boolean} True when a session exists for this user.
 * @example
 * isLinkedUser(config, 'RJ');
 */
function isLinkedUser(config, username) {
  return (
    Boolean(config.sessionKey && config.sessionUser && username) &&
    config.sessionUser.toLowerCase() === username.toLowerCase()
  );
}

export {
  POLL_INTERVAL,
  AUTO_LANGUAGE,
  MAX_USERS,
  INTERNAL_KEYS,
  normalizeConfig,
  parseUsernames,
  readLanguage,
  isLinkedUser,
};
