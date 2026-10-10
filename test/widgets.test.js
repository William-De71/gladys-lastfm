import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildNowPlayingWidget,
  buildRecentTracksWidget,
  buildTopWidget,
  readTopSettings,
  messageContent,
  WIDGET_ACTIONS,
  TTL_SECONDS,
} from '../src/widgets.js';
import { readTrack, readRecentTracks } from '../src/tracks.js';
import { rawTrack, recent, NOW, STAR } from './helpers/fixtures.js';

const MIN = 60000;

/**
 * @description A snapshot as the watcher builds it.
 * @param {Array} raws - The raw recent tracks.
 * @param {object} [extra] - Overrides.
 * @returns {object} The snapshot.
 */
function snapshotOf(raws, extra = {}) {
  const { tracks, current, total } = readRecentTracks(recent(raws));
  return {
    username: 'rj',
    fetchedAt: NOW,
    playing: Boolean(current),
    current,
    last: tracks.find((track) => !track.nowPlaying) ?? null,
    tracks,
    today: 12,
    total,
    ...extra,
  };
}

const types = (content) => content.components.map((component) => component.type);

test('now playing: cover, texts, tiles, status, love and link buttons', () => {
  const content = buildNowPlayingWidget({
    snapshot: snapshotOf([
      rawTrack({ nowPlaying: true }),
      rawTrack({ name: 'Digital Love', playedAt: NOW - 5 * MIN }),
    ]),
    language: 'fr',
    canLove: true,
    now: NOW,
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(types(content), [
    'image',
    'text',
    'text',
    'value',
    'value',
    'status',
    'button',
    'button',
  ]);
  assert.equal(content.ttl_seconds, TTL_SECONDS.playing);
  assert.equal(content.components[1].text, 'One More Time');
  assert.equal(content.components[2].text, 'Daft Punk · Discovery');
  assert.equal(content.components[5].items[0].value, 'En écoute');
  assert.deepEqual(content.components[6].action, {
    key: WIDGET_ACTIONS.LOVE,
    params: { artist: 'Daft Punk', track: 'One More Time' },
  });
});

test('now playing: stopped shows the last track, when, and an unlove button when loved', () => {
  const content = buildNowPlayingWidget({
    snapshot: snapshotOf([rawTrack({ playedAt: NOW - 90 * MIN, loved: true })]),
    language: 'en',
    canLove: true,
    now: NOW,
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.ttl_seconds, TTL_SECONDS.stopped);
  const status = content.components.find((component) => component.type === 'status');
  assert.deepEqual(
    status.items.map((item) => item.value),
    ['Not listening', '1 h ago', 'Yes'],
  );
  const love = content.components.find((component) => component.action);
  assert.equal(love.action.key, WIDGET_ACTIONS.UNLOVE);
});

test('now playing: no love button for another profile, no image for a placeholder', () => {
  const content = buildNowPlayingWidget({
    snapshot: snapshotOf([rawTrack({ nowPlaying: true, image: STAR })]),
    language: 'en',
    canLove: false,
    now: NOW,
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(!types(content).includes('image'));
  assert.ok(!content.components.some((component) => component.action));
});

test('now playing: a profile with no scrobble yet', () => {
  const content = buildNowPlayingWidget({
    snapshot: snapshotOf([], { today: 0, total: 0 }),
    language: 'fr',
    canLove: false,
    now: NOW,
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.match(content.components[0].text, /rien scrobblé/);
});

test('now playing: long titles stay within the bounds', () => {
  const content = buildNowPlayingWidget({
    snapshot: snapshotOf([
      rawTrack({ name: 'x'.repeat(200), album: 'y'.repeat(200), nowPlaying: true }),
    ]),
    language: 'en',
    canLove: false,
    now: NOW,
  });
  assert.deepEqual(validateWidgetContent(content), []);
});

test('recent tracks: list with covers, dates and badges', () => {
  const content = buildRecentTracksWidget({
    snapshot: snapshotOf([
      rawTrack({ name: 'Aerodynamic', nowPlaying: true }),
      rawTrack({ playedAt: NOW - 5 * MIN, loved: true }),
      rawTrack({ name: 'Digital Love', playedAt: NOW - 9 * MIN }),
    ]),
    language: 'fr',
    settings: { count: 2 },
  });
  assert.deepEqual(validateWidgetContent(content), []);
  const list = content.components[1];
  assert.equal(list.display, 'list');
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0].badge.text, 'En cours');
  assert.equal(list.items[0].date, undefined);
  assert.equal(list.items[1].badge.text, '♥');
  assert.equal(
    list.items[1].date,
    new Date(Math.floor((NOW - 5 * MIN) / 1000) * 1000).toISOString(),
  );
  assert.equal(list.items[1].image, 'lf-0123456789abcdef0123456789abcdef-jpg');
});

test('recent tracks: the count is bounded', () => {
  const raws = Array.from({ length: 10 }, (_, i) =>
    rawTrack({ name: `T${i}`, playedAt: NOW - i * MIN }),
  );
  const content = buildRecentTracksWidget({
    snapshot: snapshotOf(raws),
    language: 'en',
    settings: { count: 50 },
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[1].items.length, 8);
  const byDefault = buildRecentTracksWidget({ snapshot: snapshotOf(raws), language: 'en' });
  assert.equal(byDefault.components[1].items.length, 5);
});

test('top charts: settings defaults and bounds', () => {
  assert.deepEqual(readTopSettings(), { kind: 'artists', period: '7day', count: 6 });
  assert.deepEqual(readTopSettings({ kind: 'albums', period: 'overall', count: 50 }), {
    kind: 'albums',
    period: 'overall',
    count: 12,
  });
  assert.equal(readTopSettings({ kind: 'tracks', count: 12 }).count, 8);
  assert.equal(readTopSettings({ kind: 'nope', period: 'nope' }).kind, 'artists');
});

test('top charts: albums as a cover grid', () => {
  const entries = Array.from({ length: 12 }, (_, i) =>
    readTrack({
      name: `Album ${i}`,
      playcount: String(1000 - i),
      artist: { name: 'Daft Punk' },
      url: 'https://www.last.fm/music/Daft+Punk/Discovery',
      image: rawTrack().image,
    }),
  );
  const content = buildTopWidget({
    username: 'rj',
    entries,
    kind: 'albums',
    period: '1month',
    language: 'fr',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  const grid = content.components[1];
  assert.equal(grid.display, 'grid');
  assert.equal(grid.items.length, 12);
  assert.equal(grid.items[0].title, '1. Album 0');
  assert.equal(grid.items[0].subtitle, 'Daft Punk');
  assert.ok(grid.items[0].badge.text.endsWith('écoutes'));
  assert.equal(content.components[0].text, 'Top albums de rj · dernier mois');
});

test('top charts: artists as a list, without the placeholder pictures', () => {
  const entries = [
    readTrack({ name: 'Daft Punk', playcount: '123456', image: rawTrack({ image: STAR }).image }),
  ];
  const content = buildTopWidget({
    username: 'rj',
    entries,
    kind: 'artists',
    period: '7day',
    language: 'en',
  });
  assert.deepEqual(validateWidgetContent(content), []);
  const item = content.components[1].items[0];
  assert.equal(item.image, undefined);
  assert.equal(item.subtitle, undefined);
  assert.equal(item.badge.text, '123,456 plays');
});

test('top charts: an empty period', () => {
  const content = buildTopWidget({
    username: 'rj',
    entries: [],
    kind: 'tracks',
    period: '7day',
    language: 'en',
  });
  assert.deepEqual(validateWidgetContent(content), []);
});

test('a message content is valid', () => {
  assert.deepEqual(validateWidgetContent(messageContent('Hello')), []);
});
