import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SCENE_TRIGGERS } from '../src/tracker.js';
import { SCENE_ACTIONS } from '../src/scene-actions.js';
import { WIDGETS, TOP_KINDS, TOP_PERIODS, RECENT_COUNT, TOP_COUNT } from '../src/widgets.js';
import { POLL_INTERVAL, AUTO_LANGUAGE } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { buildSceneEvent } from '../src/events.js';
import { readTrack } from '../src/tracks.js';
import { fakeGladys, rawTrack } from './helpers/fixtures.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');

const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);

test('is a device integration, in lockstep with package.json', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${pkg.version}`));
});

test('Gladys 5.3.0: now playing only, catalog keywords, worldwide', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  // A Last.fm profile is not a player: no browse / search / queue / play.
  assert.deepEqual(manifest.music, {});
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  for (const keyword of keywords) {
    assert.ok(keyword.trim().length >= 2 && keyword.trim().length <= 30, keyword);
  }
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length);
  assert.ok(!normalized.includes(manifest.name.toLowerCase()));
  // Last.fm is a worldwide service.
  assert.equal(manifest.countries, undefined);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
});

test('every event carries its filters and exactly its declared variables', () => {
  const track = readTrack(rawTrack());
  manifest.scene_triggers.forEach((trigger) => {
    const { data } = buildSceneEvent(
      fakeGladys,
      'rj',
      { key: trigger.key, track, durationMs: 0, tracks: 1 },
      'en',
    );
    trigger.fields.forEach((field) => assert.ok(field.key in data, `${trigger.key}.${field.key}`));
    const declared = new Set([
      ...trigger.fields.map((field) => field.key),
      ...trigger.variables.map((variable) => variable.key),
    ]);
    Object.keys(data).forEach((key) => assert.ok(declared.has(key), `${trigger.key}: ${key}`));
    trigger.variables.forEach((variable) =>
      assert.ok(variable.key in data, `${trigger.key} variable ${variable.key}`),
    );
  });
});

test('mirrors the bounds and values of the code', () => {
  const config = byKey(manifest.config_schema);
  ['min', 'max', 'default'].forEach((bound) => {
    assert.equal(config.get('poll_interval')[bound], POLL_INTERVAL[bound]);
  });
  const widgets = byKey(manifest.widgets);
  const recentCount = byKey(widgets.get(WIDGETS.RECENT_TRACKS).settings).get('count');
  const top = byKey(widgets.get(WIDGETS.TOP_CHARTS).settings);
  ['min', 'max', 'default'].forEach((bound) => {
    assert.equal(recentCount[bound], RECENT_COUNT[bound]);
    assert.equal(top.get('count')[bound], TOP_COUNT[bound]);
  });
  assert.deepEqual(values(top.get('kind')), TOP_KINDS);
  assert.deepEqual(values(top.get('period')), TOP_PERIODS);
  const stats = byKey(byKey(manifest.scene_actions).get(SCENE_ACTIONS.GET_STATS).fields);
  assert.deepEqual(values(stats.get('period')), TOP_PERIODS);
});

test('links the account through the account_link field the code answers', () => {
  const account = byKey(manifest.config_schema).get('account');
  assert.equal(account.type, 'account_link');
  assert.deepEqual(manifest.actions.map((action) => action.key).sort(), [
    'test_connection',
    'unlink_account',
  ]);
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.equal(field.type, 'select');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
  assert.notEqual(field.required, true, 'an existing configuration has no language');
});
