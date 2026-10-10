// -----------------------------------------------------------------------------
// Listening sessions of one Last.fm profile, turned into scene events.
//
// Last.fm only tells "this track is playing now" (`@attr.nowplaying`) and
// "these tracks were scrobbled". From successive readings the tracker derives
// the transitions a scene cares about:
//   - `listening_started`  nothing was playing, something is;
//   - `track_started`      a track that was not playing a reading ago is;
//   - `listening_stopped`  nothing has been playing for two readings in a row
//                          (the "now playing" flag can vanish for one reading
//                          between two tracks, or while the player buffers);
//   - `track_loved`        a track appeared on top of the loved tracks.
//
// The first reading after a start is a baseline: what is already playing, or
// already loved, fires nothing — a restart of the container must not replay
// "listening started" for a session in progress.
//
// Known limit: the same track played twice in a row is one `track_started`
// (Last.fm gives no play id, the two readings look the same).
//
// Pure logic, no I/O: the watcher feeds it and publishes what it returns.
// -----------------------------------------------------------------------------

import { trackKey } from './tracks.js';

const SCENE_TRIGGERS = {
  TRACK_STARTED: 'track_started',
  LISTENING_STARTED: 'listening_started',
  LISTENING_STOPPED: 'listening_stopped',
  TRACK_LOVED: 'track_loved',
};

// Readings without a track playing before a session counts as stopped.
const STOP_AFTER_MISSES = 2;

/**
 * @description Create the tracker of one profile.
 * @returns {object} `{ update, updateLoved, state }`.
 * @example
 * const tracker = createTracker();
 * tracker.update({ current, now: Date.now() }); // -> [] (baseline)
 */
function createTracker() {
  const state = {
    initialized: false,
    playing: false,
    current: null,
    currentKey: '',
    sessionStart: null,
    lastSeenPlaying: null,
    sessionTracks: 0,
    misses: 0,
    lovedInitialized: false,
    lovedSince: 0,
  };

  /**
   * @description Feed a reading of the recent tracks.
   * @param {object} reading - The reading.
   * @param {object|null} reading.current - The track playing now, or null.
   * @param {number} reading.now - The time of the reading, in ms.
   * @returns {Array<{ key: string, track: object|null, durationMs?: number,
   * tracks?: number }>} The transitions, in the order they happened.
   * @example
   * tracker.update({ current: null, now: Date.now() });
   */
  function update({ current, now }) {
    const events = [];
    if (!state.initialized) {
      state.initialized = true;
      state.playing = Boolean(current);
      state.current = current;
      state.currentKey = trackKey(current);
      state.sessionStart = current ? now : null;
      state.lastSeenPlaying = current ? now : null;
      state.sessionTracks = current ? 1 : 0;
      return events;
    }

    if (current) {
      state.misses = 0;
      state.lastSeenPlaying = now;
      const key = trackKey(current);
      if (!state.playing) {
        state.playing = true;
        state.sessionStart = now;
        state.sessionTracks = 1;
        events.push({ key: SCENE_TRIGGERS.LISTENING_STARTED, track: current });
        events.push({ key: SCENE_TRIGGERS.TRACK_STARTED, track: current });
      } else if (key !== state.currentKey) {
        state.sessionTracks += 1;
        events.push({ key: SCENE_TRIGGERS.TRACK_STARTED, track: current });
      }
      state.current = current;
      state.currentKey = key;
      return events;
    }

    if (state.playing) {
      state.misses += 1;
      if (state.misses >= STOP_AFTER_MISSES) {
        events.push({
          key: SCENE_TRIGGERS.LISTENING_STOPPED,
          track: state.current,
          durationMs: Math.max(0, (state.lastSeenPlaying ?? now) - (state.sessionStart ?? now)),
          tracks: state.sessionTracks,
        });
        state.playing = false;
        state.currentKey = '';
        state.misses = 0;
        state.sessionStart = null;
        state.sessionTracks = 0;
      }
    }
    return events;
  }

  /**
   * @description Feed a reading of the latest loved tracks.
   * @param {object[]} loved - The loved tracks (with `playedAt` = love date).
   * @returns {Array<{ key: string, track: object }>} The new loves, oldest first.
   * @example
   * tracker.updateLoved([{ artist: 'Daft Punk', name: 'One More Time', playedAt: 1700000000000 }]);
   */
  function updateLoved(loved) {
    const dated = loved.filter((track) => Number.isFinite(track.playedAt));
    const newest = dated.reduce((max, track) => Math.max(max, track.playedAt), 0);
    if (!state.lovedInitialized) {
      state.lovedInitialized = true;
      state.lovedSince = newest;
      return [];
    }
    const fresh = dated
      .filter((track) => track.playedAt > state.lovedSince)
      .sort((a, b) => a.playedAt - b.playedAt);
    state.lovedSince = Math.max(state.lovedSince, newest);
    return fresh.map((track) => ({ key: SCENE_TRIGGERS.TRACK_LOVED, track }));
  }

  return { update, updateLoved, state };
}

export { SCENE_TRIGGERS, STOP_AFTER_MISSES, createTracker };
