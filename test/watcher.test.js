import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWatcher } from '../src/watcher.js';
import { LastfmError } from '../src/lastfm-api.js';
import { SCENE_TRIGGERS } from '../src/tracker.js';
import { rawTrack, recent, NOW, silent } from './helpers/fixtures.js';

const MIN = 60000;

/**
 * @description A fake Last.fm client whose answers the test changes.
 * @returns {object} The client: set `playing`, `today`, `loved`, `fail`.
 */
function fakeLastfm() {
  const client = {
    playing: null,
    today: 5,
    loved: [],
    fail: null,
    calls: [],
    async getRecentTracks(user, options) {
      client.calls.push(['recent', user, options]);
      if (client.fail) {
        throw client.fail;
      }
      if (options.from) {
        return { track: [], '@attr': { total: String(client.today) } };
      }
      const tracks = [rawTrack({ name: 'Old', playedAt: NOW - 60 * MIN })];
      if (client.playing) {
        tracks.unshift(rawTrack({ name: client.playing, nowPlaying: true }));
      }
      return recent(tracks, 1000);
    },
    async getLovedTracks(user) {
      client.calls.push(['loved', user]);
      return { track: client.loved };
    },
  };
  return client;
}

/**
 * @description A watcher on a fake client and a manual clock.
 * @param {object} lastfm - The client.
 * @param {string[]} usernames - The followed profiles.
 * @returns {object} `{ watcher, rounds, ends, tick }`.
 */
function setup(lastfm, usernames = ['rj']) {
  let clock = NOW;
  const rounds = [];
  const ends = [];
  const watcher = createWatcher({
    lastfm,
    getUsernames: () => usernames,
    getIntervalMs: () => 30000,
    onRound: (username, snapshot, info) => rounds.push({ username, snapshot, ...info }),
    onRoundEnd: (info) => ends.push(info),
    now: () => clock,
    logger: silent,
  });
  return {
    watcher,
    rounds,
    ends,
    tick: (ms = 30000) => {
      clock += ms;
    },
  };
}

test('a round reads the profile and builds its snapshot', async () => {
  const lastfm = fakeLastfm();
  lastfm.playing = 'Live';
  const { watcher, rounds, ends } = setup(lastfm);
  await watcher.round();
  assert.equal(rounds.length, 1);
  const { snapshot, events, changed } = rounds[0];
  assert.equal(changed, true);
  assert.deepEqual(events, []);
  assert.equal(snapshot.playing, true);
  assert.equal(snapshot.current.name, 'Live');
  assert.equal(snapshot.last.name, 'Old');
  assert.equal(snapshot.today, 5);
  assert.equal(snapshot.total, 1000);
  assert.deepEqual(ends, [{ errors: [] }]);
  const today = lastfm.calls.find(([kind, , options]) => kind === 'recent' && options.from);
  assert.ok(today[2].from <= Math.floor(NOW / 1000));
});

test('rounds turn into scene events, and nothing changes nothing', async () => {
  const lastfm = fakeLastfm();
  const { watcher, rounds, tick } = setup(lastfm);
  await watcher.round();
  tick();
  await watcher.round();
  assert.equal(rounds[1].changed, false);
  lastfm.playing = 'A';
  tick();
  await watcher.round();
  assert.deepEqual(
    rounds[2].events.map((event) => event.key),
    [SCENE_TRIGGERS.LISTENING_STARTED, SCENE_TRIGGERS.TRACK_STARTED],
  );
  assert.equal(rounds[2].changed, true);
  lastfm.playing = null;
  tick();
  await watcher.round();
  tick();
  await watcher.round();
  assert.deepEqual(
    rounds[4].events.map((event) => event.key),
    [SCENE_TRIGGERS.LISTENING_STOPPED],
  );
  assert.equal(rounds[4].snapshot.playing, false);
});

test('a new love fires track_loved', async () => {
  const lastfm = fakeLastfm();
  const { watcher, rounds, tick } = setup(lastfm);
  await watcher.round();
  lastfm.loved = [rawTrack({ name: 'Loved', playedAt: NOW + MIN })];
  tick();
  await watcher.round();
  assert.deepEqual(
    rounds[1].events.map((event) => [event.key, event.track.name]),
    [[SCENE_TRIGGERS.TRACK_LOVED, 'Loved']],
  );
});

test('a failed loved-tracks read costs nothing else', async () => {
  const lastfm = fakeLastfm();
  lastfm.getLovedTracks = async () => {
    throw new Error('down');
  };
  const { watcher, rounds } = setup(lastfm);
  await watcher.round();
  assert.equal(rounds.length, 1);
});

test('a failed profile is reported at the end of the round', async () => {
  const lastfm = fakeLastfm();
  lastfm.fail = new LastfmError('User not found', { code: 6 });
  const { watcher, rounds, ends } = setup(lastfm);
  await watcher.round();
  assert.equal(rounds.length, 0);
  assert.equal(ends[0].errors.length, 1);
  assert.equal(ends[0].errors[0].code, 6);
});

test('get reuses a fresh snapshot and reads a stale one', async () => {
  const lastfm = fakeLastfm();
  const { watcher, tick } = setup(lastfm);
  await watcher.get('rj', 20000);
  const reads = () => lastfm.calls.filter(([kind]) => kind === 'loved').length;
  assert.equal(reads(), 1);
  tick(10000);
  await watcher.get('RJ', 20000);
  assert.equal(reads(), 1);
  tick(30000);
  await watcher.get('rj', 20000);
  assert.equal(reads(), 2);
});

test('concurrent reads of a profile share one request', async () => {
  const lastfm = fakeLastfm();
  const { watcher } = setup(lastfm);
  const [a, b] = await Promise.all([watcher.refresh('rj'), watcher.refresh('rj')]);
  assert.equal(a, b);
  assert.equal(lastfm.calls.filter(([kind]) => kind === 'loved').length, 1);
});

test('profiles no longer followed are forgotten', async () => {
  const lastfm = fakeLastfm();
  const usernames = ['rj', 'bob'];
  const { watcher } = setup(lastfm, usernames);
  await watcher.round();
  assert.ok(watcher.peek('bob'));
  usernames.pop();
  watcher.prune();
  assert.equal(watcher.peek('bob'), null);
  assert.ok(watcher.peek('rj'));
});
