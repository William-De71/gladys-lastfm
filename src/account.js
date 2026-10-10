// -----------------------------------------------------------------------------
// Linking a Last.fm account (optional).
//
// Reading profiles needs the API key alone. Loving a track needs a session of
// the account, obtained through the Last.fm "desktop" authentication — the
// manifest `account_link` field, built for providers that never redirect
// back:
//   1. the user clicks "Connect": auth.getToken (signed) gives a request
//      token, and the browser opens last.fm/api/auth/?api_key=…&token=…;
//   2. the user approves the access on Last.fm. Nothing comes back to Gladys;
//   3. meanwhile the integration asks auth.getSession every few seconds:
//      error 14 ("token not authorized yet") until the approval, then a
//      session key that never expires (until the user revokes it).
// The token is valid 60 minutes; the integration stops waiting after 15.
//
// The session is stored in the integration config under internal keys
// (session_key, session_user), outside the config_schema: never shown, kept in
// the Gladys backups.
// -----------------------------------------------------------------------------

import { ERROR_CODES } from './lastfm-api.js';

const POLL_MS = 3000;
const WAIT_MS = 15 * 60 * 1000;

/**
 * @description Create the account linker.
 * @param {object} options - Options.
 * @param {object} options.lastfm - The Last.fm client.
 * @param {Function} options.onLinked - `async ({ name, key })`: store the session.
 * @param {Function} [options.sleep] - `(ms) => Promise` (for the tests).
 * @param {Function} [options.now] - `() => number` (for the tests).
 * @param {number} [options.pollMs] - Delay between two session checks.
 * @param {number} [options.waitMs] - How long to wait for the approval.
 * @param {object} [options.logger] - Logger.
 * @returns {object} `{ start, cancel, waiting }`.
 * @example
 * const linker = createAccountLinker({ lastfm, onLinked: storeSession });
 * const url = await linker.start();
 */
function createAccountLinker({
  lastfm,
  onLinked,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  pollMs = POLL_MS,
  waitMs = WAIT_MS,
  logger = console,
}) {
  // Each start gets a new generation: an older wait loop sees it changed and stops.
  let generation = 0;
  let pending = null;

  /**
   * @description Wait for the approval of a token, then store the session.
   * @param {string} token - The request token.
   * @param {number} mine - The generation of this wait.
   * @returns {Promise<object|null>} The session, null when abandoned.
   */
  async function waitForApproval(token, mine) {
    const deadline = now() + waitMs;
    while (mine === generation && now() < deadline) {
      await sleep(pollMs);
      if (mine !== generation) {
        return null;
      }
      try {
        const session = await lastfm.getSession(token);
        if (mine !== generation) {
          return null;
        }
        await onLinked(session);
        logger.info(`Last.fm account ${session.name} linked`);
        return session;
      } catch (err) {
        if (err.code === ERROR_CODES.UNAUTHORIZED_TOKEN) {
          continue;
        }
        if (err.code === ERROR_CODES.TOKEN_EXPIRED || err.code === ERROR_CODES.AUTH_FAILED) {
          logger.warn(`Last.fm account link abandoned: ${err.message}`);
          return null;
        }
        // Network hiccup or transient error: keep waiting.
        logger.debug(`Last.fm session not available yet: ${err.message}`);
      }
    }
    if (mine === generation) {
      logger.warn('Last.fm account link abandoned: no approval within 15 minutes');
    }
    return null;
  }

  return {
    /**
     * @description Start a link: get a token, wait for its approval in the
     * background, return the approval page.
     * @returns {Promise<string>} The URL the browser opens.
     * @throws {LastfmError} Without API key or shared secret, or when Last.fm
     * refuses them.
     */
    async start() {
      const token = await lastfm.getToken();
      generation += 1;
      const mine = generation;
      pending = waitForApproval(token, mine).finally(() => {
        if (mine === generation) {
          pending = null;
        }
      });
      return lastfm.authorizeUrl(token);
    },

    /**
     * @description Stop waiting for an approval.
     */
    cancel() {
      generation += 1;
      pending = null;
    },

    /**
     * @description The wait in progress, for the tests.
     * @returns {Promise<object|null>|null} The wait.
     */
    waiting() {
      return pending;
    },
  };
}

export { createAccountLinker };
