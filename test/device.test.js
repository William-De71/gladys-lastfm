import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GladysIntegration } from '@gladysassistant/integration-sdk';

import {
  buildDevice,
  buildStates,
  usernameFromExternalId,
  idsOf,
  FEATURE_KEYS,
  PLAYBACK_STATE,
  nowPlayingOf,
  nowPlayingFeatureIds,
} from '../src/device.js';
import { buildSceneEvent } from '../src/events.js';
import { SCENE_TRIGGERS } from '../src/tracker.js';
import { readTrack } from '../src/tracks.js';
import { fakeGladys, rawTrack, NOW, COVER, STAR } from './helpers/fixtures.js';

const track = readTrack(rawTrack({ playedAt: NOW, loved: true }));

test('builds one device per profile, on the lowercased username', () => {
  const device = buildDevice(fakeGladys, 'RJ', 'fr');
  assert.equal(device.name, 'Last.fm – RJ');
  assert.equal(device.external_id, 'ext:lastfm:user:rj');
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.features.map((feature) => feature.external_id),
    Object.values(FEATURE_KEYS).map((key) => `ext:lastfm:user:rj:${key}`),
  );
  assert.ok(device.features.every((feature) => feature.read_only === true));
  assert.equal(device.features[0].name, 'En écoute');
});

test('uses the real SDK ids', () => {
  const gladys = new GladysIntegration({
    selector: 'ext-dev-lastfm',
    hostApiUrl: 'http://localhost',
    token: 't',
  });
  const ids = idsOf(gladys, 'RJ');
  assert.equal(ids.device, 'ext:ext-dev-lastfm:user:rj');
  assert.equal(usernameFromExternalId(ids.device, ['RJ']), 'RJ');
  assert.equal(usernameFromExternalId(ids.feature('now_playing'), ['RJ']), 'RJ');
});

test('maps a device back to a followed username', () => {
  assert.equal(usernameFromExternalId('ext:lastfm:user:bob', ['RJ', 'Bob']), 'Bob');
  assert.equal(usernameFromExternalId('ext:lastfm:user:gone', ['RJ']), null);
  assert.equal(usernameFromExternalId('', ['RJ']), null);
  assert.equal(usernameFromExternalId(undefined, ['RJ']), null);
});

test('publishes the four states while playing', () => {
  const states = buildStates(fakeGladys, 'rj', {
    playing: true,
    current: track,
    last: null,
    today: 12,
    total: 1234,
  });
  assert.deepEqual(states, [
    { device_feature_external_id: 'ext:lastfm:user:rj:playing', state: PLAYBACK_STATE.PLAYING },
    {
      device_feature_external_id: 'ext:lastfm:user:rj:now_playing',
      text: 'Daft Punk – One More Time',
    },
    { device_feature_external_id: 'ext:lastfm:user:rj:today', state: 12 },
    { device_feature_external_id: 'ext:lastfm:user:rj:total', state: 1234 },
  ]);
});

test('keeps the last track, omits the unknown counters', () => {
  const states = buildStates(fakeGladys, 'rj', {
    playing: false,
    current: null,
    last: track,
    today: null,
    total: null,
  });
  assert.deepEqual(
    states.map((state) => state.state ?? state.text),
    [PLAYBACK_STATE.STOPPED, 'Daft Punk – One More Time'],
  );
  assert.equal(
    buildStates(fakeGladys, 'rj', { playing: false, current: null, last: null }).length,
    1,
  );
});

test('builds the data of a track_started event', () => {
  const { key, data } = buildSceneEvent(
    fakeGladys,
    'RJ',
    { key: SCENE_TRIGGERS.TRACK_STARTED, track },
    'fr',
  );
  assert.equal(key, 'track_started');
  assert.deepEqual(data, {
    user: 'ext:lastfm:user:rj',
    user_name: 'RJ',
    artist: 'Daft Punk',
    track: 'One More Time',
    album: 'Discovery',
    loved: true,
    url: track.url,
    summary: 'RJ écoute Daft Punk – One More Time.',
  });
});

test('builds the data of a listening_stopped event', () => {
  const { data } = buildSceneEvent(
    fakeGladys,
    'rj',
    { key: SCENE_TRIGGERS.LISTENING_STOPPED, track, durationMs: 42 * 60000, tracks: 11 },
    'en',
  );
  assert.equal(data.duration_minutes, 42);
  assert.equal(data.tracks_played, 11);
  assert.equal(data.summary, 'rj stopped listening after 42 min (11 tracks).');
});

test('keeps every event flat, scalar and bounded', () => {
  const long = readTrack(rawTrack({ name: 'x'.repeat(3000) }));
  Object.values(SCENE_TRIGGERS).forEach((key) => {
    const { data } = buildSceneEvent(
      fakeGladys,
      'rj',
      { key, track: long, durationMs: 0, tracks: 1 },
      'en',
    );
    assert.ok(Object.keys(data).length <= 30);
    Object.values(data).forEach((value) => {
      assert.ok(['string', 'number', 'boolean'].includes(typeof value));
      if (typeof value === 'string') {
        assert.ok(value.length <= 1000);
      }
    });
  });
});

test('the music features of Gladys 5.3.0: read-only, no history, after those of 1.0.0', () => {
  const device = buildDevice(fakeGladys, 'RJ', 'de');
  const music = device.features.slice(4);
  assert.deepEqual(
    music.map((feature) => [feature.external_id, feature.category, feature.type]),
    [
      ['ext:lastfm:user:rj:music_title', 'music', 'title'],
      ['ext:lastfm:user:rj:music_artist', 'music', 'artist'],
      ['ext:lastfm:user:rj:music_album', 'music', 'album'],
      ['ext:lastfm:user:rj:music_artwork', 'music', 'artwork'],
    ],
  );
  assert.ok(music.every((feature) => feature.read_only && feature.keep_history === false));
  assert.deepEqual(
    music.map((feature) => feature.name),
    ['Titel', 'Interpret', 'Album', 'Cover'],
  );
});

test('the now playing: the track playing now, emptied when nothing plays', () => {
  const playing = readTrack(rawTrack({ nowPlaying: true }));
  assert.deepEqual(nowPlayingOf({ playing: true, current: playing }), {
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    artwork_url: COVER,
  });
  const empty = { title: '', artist: '', album: '', artwork_url: null };
  // The last track stays in the `now_playing` text, never in the music features.
  assert.deepEqual(nowPlayingOf({ playing: false, current: null, last: track }), empty);
  assert.deepEqual(nowPlayingOf({ playing: false, current: playing }), empty);
  assert.deepEqual(nowPlayingOf(null), empty);
  // The grey star of Last.fm is no cover.
  const starred = readTrack(rawTrack({ nowPlaying: true, image: STAR }));
  assert.equal(nowPlayingOf({ playing: true, current: starred }).artwork_url, null);
});

test('the now playing goes to the music_* features, never the SDK default ids', () => {
  assert.deepEqual(nowPlayingFeatureIds(fakeGladys, 'rj'), {
    title: 'ext:lastfm:user:rj:music_title',
    artist: 'ext:lastfm:user:rj:music_artist',
    album: 'ext:lastfm:user:rj:music_album',
    artwork: 'ext:lastfm:user:rj:music_artwork',
  });
  assert.equal(usernameFromExternalId('ext:lastfm:user:rj:music_title', ['RJ']), 'RJ');
});

test('the SDK publishes the now playing once, then only what changed', async () => {
  const gladys = new GladysIntegration({
    selector: 'lastfm',
    hostApiUrl: 'http://localhost',
    token: 't',
  });
  const sent = [];
  gladys.publishStates = async (states) => {
    sent.push(states);
    return { success: true };
  };
  const playing = readTrack(rawTrack({ nowPlaying: true }));
  const options = { featureExternalIds: nowPlayingFeatureIds(gladys, 'rj') };
  const device = idsOf(gladys, 'rj').device;
  await gladys.publishNowPlaying(
    device,
    nowPlayingOf({ playing: true, current: playing }),
    options,
  );
  await gladys.publishNowPlaying(
    device,
    nowPlayingOf({ playing: true, current: playing }),
    options,
  );
  await gladys.publishNowPlaying(device, nowPlayingOf({ playing: false, current: null }), options);
  assert.equal(sent.length, 2);
  assert.deepEqual(
    sent[0].map((state) => state.device_feature_external_id),
    Object.values(options.featureExternalIds),
  );
  assert.equal(sent[0][3].text, gladys.artworkKey(COVER));
  assert.deepEqual(
    sent[1].map((state) => state.text),
    ['', '', '', ''],
  );
});
