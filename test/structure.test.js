// -----------------------------------------------------------------------------
// Non-regression of everything users store: the device and feature external
// ids, the fields the Discovery "Update" button compares (category, type,
// unit, min, max, step), and every key of the manifest a scene, a widget or a
// saved configuration refers to.
//
// test/fixtures/discovery.baseline.json was generated from version 1.0.0,
// before any change, then extended with the features added since (the
// `music_*` now playing of Gladys 5.3.0): additions only, appended after the
// features of 1.0.0, which are unchanged. A failure here means existing users would have to delete
// and recreate a device, or would lose a scene or a widget setting: never
// update the baseline without a documented migration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildDevice } from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys } from './helpers/fixtures.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const baseline = read('./fixtures/discovery.baseline.json');
const manifest = read('../gladys-assistant-integration.json');

const ETERNAL = [
  'external_id',
  'category',
  'type',
  'unit',
  'min',
  'max',
  'step',
  'read_only',
  'has_feedback',
];
const pick = (feature) =>
  Object.fromEntries(
    ETERNAL.filter((key) => feature[key] !== undefined).map((key) => [key, feature[key]]),
  );
const keys = (list) => (list ?? []).map((entry) => entry.key);
const byKey = (list) => new Map((list ?? []).map((entry) => [entry.key, entry]));

test('the device keeps its external ids and the fields Discovery compares, in every language', () => {
  for (const language of LANGUAGES) {
    const device = buildDevice(fakeGladys, 'RJ', language);
    assert.equal(device.external_id, baseline.device.external_id);
    assert.equal(device.should_poll, baseline.device.should_poll);
    assert.deepEqual(
      device.params.map((param) => param.name),
      baseline.device.params,
    );
    assert.deepEqual(device.features.map(pick), baseline.device.features, language);
    for (const feature of device.features) {
      for (const field of ['min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[field], undefined, `${feature.external_id}.${field}`);
      }
    }
  }
});

test('no configuration key disappears or changes type', () => {
  const current = byKey(manifest.config_schema);
  for (const { key, type } of baseline.manifest.config_schema) {
    assert.equal(current.get(key)?.type, type, `config_schema.${key}`);
  }
});

test('no configuration action disappears', () => {
  const current = keys(manifest.actions);
  for (const key of baseline.manifest.actions) {
    assert.ok(current.includes(key), `actions.${key}`);
  }
});

test('scene triggers keep their keys, filters and variables', () => {
  const current = byKey(manifest.scene_triggers);
  for (const trigger of baseline.manifest.scene_triggers) {
    const now = current.get(trigger.key);
    assert.ok(now, `scene_triggers.${trigger.key}`);
    for (const field of trigger.fields) {
      assert.ok(keys(now.fields).includes(field), `${trigger.key}.fields.${field}`);
    }
    const variables = byKey(now.variables);
    for (const { key, type } of trigger.variables) {
      assert.equal(variables.get(key)?.type, type, `${trigger.key}.variables.${key}`);
    }
  }
});

test('scene actions keep their keys, fields and outputs', () => {
  const current = byKey(manifest.scene_actions);
  for (const action of baseline.manifest.scene_actions) {
    const now = current.get(action.key);
    assert.ok(now, `scene_actions.${action.key}`);
    for (const field of action.fields) {
      assert.ok(keys(now.fields).includes(field), `${action.key}.fields.${field}`);
    }
    const outputs = byKey(now.outputs);
    for (const { key, type } of action.outputs) {
      assert.equal(outputs.get(key)?.type, type, `${action.key}.outputs.${key}`);
    }
  }
});

test('widgets keep their keys, settings and option values', () => {
  const current = byKey(manifest.widgets);
  for (const widget of baseline.manifest.widgets) {
    const now = current.get(widget.key);
    assert.ok(now, `widgets.${widget.key}`);
    const settings = byKey(now.settings);
    for (const key of widget.settings) {
      assert.ok(settings.has(key), `${widget.key}.settings.${key}`);
    }
    for (const [key, values] of Object.entries(widget.options)) {
      const options = settings.get(key).options.map((option) => option.value);
      for (const value of values) {
        assert.ok(options.includes(value), `${widget.key}.settings.${key}: ${value}`);
      }
    }
  }
});
