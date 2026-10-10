import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildNowPlayingOutputs, buildStatsOutputs, loveTarget } from '../src/scene-actions.js';
import { readTrack } from '../src/tracks.js';
import { rawTrack, NOW } from './helpers/fixtures.js';

const playing = readTrack(rawTrack({ nowPlaying: true, loved: true }));
const played = readTrack(rawTrack({ name: 'Digital Love', playedAt: NOW }));

const snapshot = (extra) => ({
  username: 'rj',
  playing: false,
  current: null,
  last: played,
  today: 3,
  total: 999,
  ...extra,
});

test('what is playing: while playing', () => {
  const outputs = buildNowPlayingOutputs(snapshot({ playing: true, current: playing }), 'fr');
  assert.deepEqual(outputs, {
    user_name: 'rj',
    playing: true,
    artist: 'Daft Punk',
    track: 'One More Time',
    album: 'Discovery',
    loved: true,
    url: playing.url,
    played_at: '',
    summary: 'rj écoute Daft Punk – One More Time.',
  });
});

test('what is playing: stopped, the last track with its time', () => {
  const outputs = buildNowPlayingOutputs(snapshot(), 'en');
  assert.equal(outputs.playing, false);
  assert.equal(outputs.track, 'Digital Love');
  assert.notEqual(outputs.played_at, '');
  assert.equal(outputs.summary, 'rj is not listening; last track: Daft Punk – Digital Love.');
});

test('what is playing: nothing yet', () => {
  const outputs = buildNowPlayingOutputs(snapshot({ last: null }), 'en');
  assert.equal(outputs.artist, '');
  assert.equal(outputs.summary, 'rj has no track yet.');
});

test('statistics', () => {
  const outputs = buildStatsOutputs({
    snapshot: snapshot(),
    topArtist: { name: 'Daft Punk', playcount: 42 },
    topAlbum: { name: 'Discovery', artist: 'Daft Punk' },
    topTrack: { name: 'One More Time', artist: 'Daft Punk' },
    period: '7day',
    language: 'fr',
  });
  assert.deepEqual(outputs, {
    user_name: 'rj',
    scrobbles_today: 3,
    scrobbles_total: 999,
    top_artist: 'Daft Punk',
    top_artist_plays: 42,
    top_album: 'Daft Punk – Discovery',
    top_track: 'Daft Punk – One More Time',
    summary:
      'rj : 3 scrobbles aujourd’hui, 999 au total. Artiste préféré (7 derniers jours) : Daft Punk.',
  });
});

test('statistics without charts nor counters', () => {
  const outputs = buildStatsOutputs({
    snapshot: snapshot({ today: null, total: null }),
    topArtist: null,
    topAlbum: null,
    topTrack: null,
    period: 'overall',
    language: 'en',
  });
  assert.equal(outputs.scrobbles_today, null);
  assert.equal(outputs.top_artist, '');
  assert.match(outputs.summary, /\? scrobbles today/);
});

test('love target: the fields, else the current or last track', () => {
  assert.deepEqual(loveTarget({ artist: ' Air ', track: ' Sexy Boy ' }, null), {
    artist: 'Air',
    track: 'Sexy Boy',
  });
  assert.deepEqual(loveTarget({ artist: 'Air', track: '' }, snapshot({ current: playing })), {
    artist: 'Daft Punk',
    track: 'One More Time',
  });
  assert.deepEqual(loveTarget({}, snapshot()), { artist: 'Daft Punk', track: 'Digital Love' });
  assert.equal(loveTarget({}, snapshot({ last: null })), null);
  assert.equal(loveTarget({}, null), null);
});
