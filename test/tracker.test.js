import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createTracker, SCENE_TRIGGERS, STOP_AFTER_MISSES } from '../src/tracker.js';
import { readTrack } from '../src/tracks.js';
import { rawTrack, NOW } from './helpers/fixtures.js';

const MIN = 60000;
const song = (name) => readTrack(rawTrack({ name, nowPlaying: true }));
const keys = (events) => events.map((event) => event.key);

test('the first reading is a baseline, playing or not', () => {
  assert.deepEqual(createTracker().update({ current: song('A'), now: NOW }), []);
  assert.deepEqual(createTracker().update({ current: null, now: NOW }), []);
});

test('a session in progress at startup does not fire, its next track does', () => {
  const tracker = createTracker();
  tracker.update({ current: song('A'), now: NOW });
  assert.deepEqual(tracker.update({ current: song('A'), now: NOW + MIN }), []);
  assert.deepEqual(keys(tracker.update({ current: song('B'), now: NOW + 2 * MIN })), [
    SCENE_TRIGGERS.TRACK_STARTED,
  ]);
});

test('listening starts with its first track', () => {
  const tracker = createTracker();
  tracker.update({ current: null, now: NOW });
  const events = tracker.update({ current: song('A'), now: NOW + MIN });
  assert.deepEqual(keys(events), [SCENE_TRIGGERS.LISTENING_STARTED, SCENE_TRIGGERS.TRACK_STARTED]);
  assert.equal(events[1].track.name, 'A');
  assert.equal(tracker.state.playing, true);
});

test('one reading without a track is not a stop', () => {
  const tracker = createTracker();
  tracker.update({ current: null, now: NOW });
  tracker.update({ current: song('A'), now: NOW + MIN });
  assert.deepEqual(tracker.update({ current: null, now: NOW + 2 * MIN }), []);
  assert.equal(tracker.state.playing, true);
  // The flag came back with the next track: same session, no restart.
  assert.deepEqual(keys(tracker.update({ current: song('B'), now: NOW + 3 * MIN })), [
    SCENE_TRIGGERS.TRACK_STARTED,
  ]);
});

test('listening stops after two readings without a track, with the session figures', () => {
  const tracker = createTracker();
  tracker.update({ current: null, now: NOW });
  tracker.update({ current: song('A'), now: NOW });
  tracker.update({ current: song('B'), now: NOW + 4 * MIN });
  tracker.update({ current: song('C'), now: NOW + 8 * MIN });
  let events = [];
  for (let i = 1; i <= STOP_AFTER_MISSES; i += 1) {
    events = tracker.update({ current: null, now: NOW + (8 + i) * MIN });
  }
  assert.deepEqual(keys(events), [SCENE_TRIGGERS.LISTENING_STOPPED]);
  assert.equal(events[0].track.name, 'C');
  assert.equal(events[0].durationMs, 8 * MIN);
  assert.equal(events[0].tracks, 3);
  assert.equal(tracker.state.playing, false);
  // Stopped stays stopped: no second stop.
  assert.deepEqual(tracker.update({ current: null, now: NOW + 20 * MIN }), []);
  // And the next track starts a new session.
  assert.deepEqual(keys(tracker.update({ current: song('C'), now: NOW + 30 * MIN })), [
    SCENE_TRIGGERS.LISTENING_STARTED,
    SCENE_TRIGGERS.TRACK_STARTED,
  ]);
});

test('the same track across readings fires once', () => {
  const tracker = createTracker();
  tracker.update({ current: null, now: NOW });
  tracker.update({ current: song('A'), now: NOW });
  assert.deepEqual(tracker.update({ current: song('A'), now: NOW + MIN }), []);
});

test('loved tracks: baseline, then only the new ones, oldest first', () => {
  const tracker = createTracker();
  const loved = (name, at) => ({ ...readTrack(rawTrack({ name })), playedAt: at });
  assert.deepEqual(tracker.updateLoved([loved('A', NOW - MIN)]), []);
  assert.deepEqual(tracker.updateLoved([loved('A', NOW - MIN)]), []);
  const events = tracker.updateLoved([
    loved('C', NOW + 2 * MIN),
    loved('B', NOW + MIN),
    loved('A', NOW - MIN),
  ]);
  assert.deepEqual(
    events.map((event) => [event.key, event.track.name]),
    [
      [SCENE_TRIGGERS.TRACK_LOVED, 'B'],
      [SCENE_TRIGGERS.TRACK_LOVED, 'C'],
    ],
  );
  // An unloved-then-loved older track does not travel back in time.
  assert.deepEqual(tracker.updateLoved([loved('C', NOW + 2 * MIN)]), []);
});

test('loved tracks: an empty first reading is a baseline too', () => {
  const tracker = createTracker();
  assert.deepEqual(tracker.updateLoved([]), []);
  assert.equal(tracker.updateLoved([{ ...readTrack(rawTrack()), playedAt: NOW }]).length, 1);
});
