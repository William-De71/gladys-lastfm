// -----------------------------------------------------------------------------
// The watcher: reads every followed profile on a loop.
//
// Per profile and per round, three read calls:
//   - user.getRecentTracks (limit 10, extended): the track playing now, the
//     latest scrobbles with their "loved" flag, and the total scrobble count
//     (`@attr.total` of an unbounded range);
//   - user.getRecentTracks (limit 1, from = midnight): today's count;
//   - user.getLovedTracks (limit 5): for the "track loved" trigger — optional,
//     its failure costs the trigger one round, nothing else.
// The profiles are read one after the other: at the default 30 s, three
// profiles cost 0.3 request per second, far below the Last.fm limit (about 5
// per second, averaged over 5 minutes).
//
// Each round leaves a snapshot per profile, the single source the devices,
// the widgets and the scene actions read from (a widget never costs an extra
// call while the snapshot is fresh). The tracker of the profile turns the
// round into scene events.
//
// The loop is a chain of timeouts, not an interval: a slow round never
// overlaps the next one, and a new poll interval takes effect at once.
// -----------------------------------------------------------------------------

import { createTracker } from './tracker.js';
import { readRecentTracks, readTrack, asArray, trackKey } from './tracks.js';
import { startOfDay } from './time.js';

/**
 * @description Create the watcher.
 * @param {object} options - Options.
 * @param {object} options.lastfm - The Last.fm client.
 * @param {Function} options.getUsernames - `() => string[]`.
 * @param {Function} options.getIntervalMs - `() => number`.
 * @param {Function} [options.onRound] - `(username, snapshot, { events, changed })`
 * after every successful read of a profile.
 * @param {Function} [options.onRoundEnd] - `({ errors })` after every round,
 * `errors` the LastfmError of each failed profile.
 * @param {Function} [options.now] - `() => number` in ms (for the tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} The watcher.
 * @example
 * const watcher = createWatcher({ lastfm, getUsernames: () => ['rj'], getIntervalMs: () => 30000 });
 */
function createWatcher({
  lastfm,
  getUsernames,
  getIntervalMs,
  onRound = () => {},
  onRoundEnd = () => {},
  now = () => Date.now(),
  logger = console,
}) {
  // lowercased username -> { tracker, snapshot, inFlight, lastErrorMessage }
  const profiles = new Map();
  let timer = null;
  let running = false;

  /**
   * @description The entry of a profile, created on first use.
   * @param {string} username - The username.
   * @returns {object} The entry.
   */
  function entryOf(username) {
    const key = username.toLowerCase();
    if (!profiles.has(key)) {
      profiles.set(key, {
        tracker: createTracker(),
        snapshot: null,
        inFlight: null,
        lastErrorMessage: null,
      });
    }
    return profiles.get(key);
  }

  /**
   * @description Forget the profiles that are not followed any more.
   * @example
   * watcher.prune();
   */
  function prune() {
    const followed = new Set(getUsernames().map((name) => name.toLowerCase()));
    [...profiles.keys()].forEach((key) => {
      if (!followed.has(key)) {
        profiles.delete(key);
      }
    });
  }

  /**
   * @description Read a profile once, update its tracker and snapshot.
   * @param {string} username - The username.
   * @returns {Promise<object>} The snapshot.
   */
  async function read(username) {
    const entry = entryOf(username);
    const time = now();
    const [recentRaw, todayRaw, lovedRaw] = await Promise.all([
      lastfm.getRecentTracks(username, { limit: 10, extended: true }),
      lastfm.getRecentTracks(username, {
        limit: 1,
        from: Math.floor(startOfDay(time) / 1000),
        extended: false,
      }),
      lastfm.getLovedTracks(username, 5).catch((err) => {
        logger.debug(`Loved tracks of ${username} unavailable: ${err.message}`);
        return null;
      }),
    ]);
    const recent = readRecentTracks(recentRaw);
    const today = readRecentTracks(todayRaw);
    const events = entry.tracker.update({ current: recent.current, now: time });
    if (lovedRaw) {
      events.push(...entry.tracker.updateLoved(asArray(lovedRaw.track).map(readTrack)));
    }
    const previous = entry.snapshot;
    const snapshot = {
      username,
      fetchedAt: time,
      playing: entry.tracker.state.playing,
      current: recent.current,
      last: recent.tracks.find((track) => !track.nowPlaying) ?? null,
      tracks: recent.tracks,
      today: today.total,
      total: recent.total,
    };
    entry.snapshot = snapshot;
    entry.lastErrorMessage = null;
    const changed =
      !previous ||
      previous.playing !== snapshot.playing ||
      trackKey(previous.current) !== trackKey(snapshot.current) ||
      previous.current?.loved !== snapshot.current?.loved ||
      trackKey(previous.last) !== trackKey(snapshot.last) ||
      previous.today !== snapshot.today ||
      previous.total !== snapshot.total;
    try {
      await onRound(username, snapshot, { events, changed });
    } catch (err) {
      logger.warn(`Unable to publish the round of ${username}: ${err.message}`);
    }
    return snapshot;
  }

  /**
   * @description Read a profile now, sharing a read already in flight.
   * @param {string} username - The username.
   * @returns {Promise<object>} The snapshot.
   * @example
   * const snapshot = await watcher.refresh('rj');
   */
  function refresh(username) {
    const entry = entryOf(username);
    if (!entry.inFlight) {
      entry.inFlight = read(username).finally(() => {
        entry.inFlight = null;
      });
    }
    return entry.inFlight;
  }

  /**
   * @description The snapshot of a profile, read again when older than `maxAgeMs`.
   * @param {string} username - The username.
   * @param {number} maxAgeMs - The accepted age.
   * @returns {Promise<object>} The snapshot.
   * @example
   * const snapshot = await watcher.get('rj', 60000);
   */
  async function get(username, maxAgeMs) {
    const { snapshot } = entryOf(username);
    if (snapshot && now() - snapshot.fetchedAt <= maxAgeMs) {
      return snapshot;
    }
    return refresh(username);
  }

  /**
   * @description Read every followed profile once.
   * @returns {Promise<{ errors: Error[] }>} The failures of the round.
   * @example
   * await watcher.round();
   */
  async function round() {
    prune();
    const errors = [];
    for (const username of getUsernames()) {
      try {
        await refresh(username);
      } catch (err) {
        errors.push(err);
        const entry = entryOf(username);
        // Logged once per distinct failure, not every 30 seconds.
        if (entry.lastErrorMessage !== err.message) {
          entry.lastErrorMessage = err.message;
          logger.warn(`Unable to read the Last.fm profile ${username}: ${err.message}`);
        }
      }
    }
    try {
      await onRoundEnd({ errors });
    } catch (err) {
      logger.warn(`Round end handler failed: ${err.message}`);
    }
    return { errors };
  }

  /**
   * @description Schedule the next round.
   */
  function schedule() {
    // Already scheduled: a stop/start during a round must not chain twice.
    if (!running || timer) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      await round();
      schedule();
    }, getIntervalMs());
  }

  return {
    refresh,
    get,
    round,
    prune,
    /**
     * @description The last snapshot of a profile, without reading.
     * @param {string} username - The username.
     * @returns {object|null} The snapshot.
     */
    peek(username) {
      return profiles.get(username.toLowerCase())?.snapshot ?? null;
    },
    /**
     * @description Start the loop: one round now, then every interval.
     * @example
     * watcher.start();
     */
    start() {
      if (running) {
        return;
      }
      running = true;
      round().finally(schedule);
    },
    /**
     * @description Stop the loop (a round in progress completes).
     * @example
     * watcher.stop();
     */
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    /**
     * @description Reschedule the next round with the current interval.
     * @example
     * watcher.reschedule();
     */
    reschedule() {
      if (running && timer) {
        clearTimeout(timer);
        timer = null;
        schedule();
      }
    },
  };
}

export { createWatcher };
