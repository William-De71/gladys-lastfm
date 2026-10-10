import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  asArray,
  textOf,
  readTrack,
  readRecentTracks,
  readUser,
  trackKey,
  trackLabel,
} from '../src/tracks.js';
import { largestImage, imageKeyFromUrl, imageUrlFromKey } from '../src/images.js';
import { rawTrack, recent, images, COVER, STAR, NOW } from './helpers/fixtures.js';

test('makes a list of a single element', () => {
  assert.deepEqual(asArray({ a: 1 }), [{ a: 1 }]);
  assert.deepEqual(asArray([1, 2]), [1, 2]);
  assert.deepEqual(asArray(undefined), []);
  assert.deepEqual(asArray('x'), []);
});

test('reads the text of the XML-shaped values', () => {
  assert.equal(textOf({ '#text': ' Daft Punk ' }), 'Daft Punk');
  assert.equal(textOf({ name: 'Daft Punk', '#text': 'ignored' }), 'Daft Punk');
  assert.equal(textOf(null), '');
});

test('reads a played track (extended)', () => {
  const playedAt = NOW - 120000;
  assert.deepEqual(readTrack(rawTrack({ playedAt, loved: true })), {
    artist: 'Daft Punk',
    name: 'One More Time',
    album: 'Discovery',
    url: 'https://www.last.fm/music/Daft%20Punk/_/One%20More%20Time',
    image: COVER,
    nowPlaying: false,
    playedAt,
    loved: true,
    playcount: null,
  });
});

test('reads a plain (non extended) track', () => {
  const track = readTrack({
    artist: { mbid: '', '#text': 'Air' },
    name: 'La femme d’argent',
    album: { '#text': 'Moon Safari' },
    '@attr': { nowplaying: 'true' },
  });
  assert.equal(track.artist, 'Air');
  assert.equal(track.nowPlaying, true);
  assert.equal(track.playedAt, null);
  assert.equal(track.loved, null);
  assert.equal(track.image, null);
});

test('reads the recent tracks: current, order, total', () => {
  const answer = recent(
    [
      rawTrack({ name: 'Aerodynamic', nowPlaying: true }),
      rawTrack({ playedAt: NOW - 300000 }),
      { name: '', artist: { name: '' } },
    ],
    4321,
  );
  const result = readRecentTracks(answer);
  assert.equal(result.tracks.length, 2);
  assert.equal(result.current.name, 'Aerodynamic');
  assert.equal(result.total, 4321);
});

test('reads a single recent track and an empty answer', () => {
  assert.equal(readRecentTracks(recent([rawTrack({ playedAt: NOW })])).tracks.length, 1);
  assert.deepEqual(readRecentTracks({}), { tracks: [], current: null, total: null });
  assert.equal(readRecentTracks({ track: [], '@attr': { total: '0' } }).total, 0);
});

test('identifies and labels a track', () => {
  const a = readTrack(rawTrack());
  const b = readTrack(rawTrack({ artist: 'DAFT PUNK' }));
  assert.equal(trackKey(a), trackKey(b));
  assert.notEqual(trackKey(a), trackKey(readTrack(rawTrack({ name: 'Digital Love' }))));
  assert.equal(trackKey(null), '');
  assert.equal(trackLabel(a), 'Daft Punk – One More Time');
  assert.equal(trackLabel(null), '');
});

test('reads a profile', () => {
  assert.deepEqual(
    readUser({
      name: 'RJ',
      realname: 'Richard',
      url: 'https://www.last.fm/user/RJ',
      playcount: '150000',
      image: [],
    }),
    {
      name: 'RJ',
      realname: 'Richard',
      url: 'https://www.last.fm/user/RJ',
      playcount: 150000,
      image: null,
    },
  );
});

test('picks the largest image', () => {
  assert.equal(largestImage(images(COVER)), COVER);
  assert.equal(largestImage([{ size: 'small', '#text': '' }]), null);
  assert.equal(largestImage(undefined), null);
});

test('turns a cover into a key and back, whatever its size', () => {
  const key = imageKeyFromUrl(COVER.replace('300x300', '174s'));
  assert.equal(key, 'lf-0123456789abcdef0123456789abcdef-jpg');
  assert.ok(/^[a-z0-9][a-z0-9-]{0,63}$/.test(key));
  assert.equal(imageUrlFromKey(key), COVER);
});

test('gives no key to placeholders, GIFs and foreign URLs', () => {
  assert.equal(imageKeyFromUrl(STAR), null);
  assert.equal(imageKeyFromUrl(COVER.replace('.jpg', '.gif')), null);
  assert.equal(imageKeyFromUrl('https://evil.example/whatever.png'), null);
  assert.equal(imageKeyFromUrl(null), null);
});

test('rebuilds no URL from a key it never produced', () => {
  assert.equal(imageUrlFromKey('lf-../../etc-png'), null);
  assert.equal(imageUrlFromKey('nws-day-skc'), null);
  assert.equal(imageUrlFromKey('lf-0123456789abcdef0123456789abcdef-gif'), null);
});
