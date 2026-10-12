import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { LANGUAGES, TEXTS, all, t } from '../src/i18n.js';
import { buildNowPlayingWidget, buildRecentTracksWidget, buildTopWidget } from '../src/widgets.js';
import { buildNowPlayingOutputs, buildStatsOutputs } from '../src/scene-actions.js';
import { buildDevice } from '../src/device.js';
import { readTrack, readRecentTracks } from '../src/tracks.js';
import { fakeGladys, rawTrack, recent, NOW } from './helpers/fixtures.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(read('../gladys-assistant-integration.json'));

/**
 * @description Every multi-language object of the manifest, with its path.
 * @param {unknown} node - A manifest node.
 * @param {string} path - Its path.
 * @returns {Array<[string, object]>} The texts.
 */
function texts(node, path = '') {
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => texts(child, `${path}[${i}]`));
  }
  if (node && typeof node === 'object') {
    if (typeof node.en === 'string') {
      return [[path, node]];
    }
    return Object.entries(node).flatMap(([key, child]) => texts(child, `${path}.${key}`));
  }
  return [];
}

test('every manifest text exists in English, French, German and Spanish', () => {
  const all = texts(manifest);
  assert.ok(all.length > 50);
  for (const [path, text] of all) {
    for (const language of LANGUAGES) {
      assert.ok(text[language]?.trim(), `${path}.${language} is missing`);
    }
  }
});

test('catalog description: 10 to 100 characters per language', () => {
  for (const language of LANGUAGES) {
    const { length } = manifest.description[language];
    assert.ok(length >= 10 && length <= 100, `description.${language}: ${length}`);
  }
});

test('widget labels: 3 to 30 characters per language', () => {
  for (const widget of manifest.widgets) {
    for (const language of LANGUAGES) {
      const { length } = widget.label[language];
      assert.ok(length >= 3 && length <= 30, `${widget.key}.label.${language}: ${length}`);
    }
  }
});

test('every runtime text exists in the four languages, with the same placeholders', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [key, entry] of Object.entries(TEXTS)) {
    for (const language of LANGUAGES) {
      assert.ok(entry[language], `${key}.${language} is missing`);
      assert.deepEqual(placeholders(entry[language]), placeholders(entry.en), `${key}.${language}`);
    }
  }
  assert.deepEqual(Object.keys(all('statusReadOnly')), LANGUAGES);
});

test('connection and action messages stay within 200 characters per language', () => {
  for (const key of ['statusLinked', 'statusReadOnly', 'statusInvalidKey', 'statusUnreachable']) {
    for (const [language, text] of Object.entries(all(key, { user: 'a'.repeat(15) }))) {
      assert.ok(text.length <= 200, `${key}.${language}: ${text.length}`);
    }
  }
  for (const key of ['lovedToast', 'unlovedToast', 'notLinked', 'unlinked']) {
    for (const [language, text] of Object.entries(all(key, { track: 'x'.repeat(60) }))) {
      assert.ok(text.length <= 200, `${key}.${language}: ${text.length}`);
    }
  }
});

test('the widgets are valid in every language', () => {
  const { tracks, current, total } = readRecentTracks(
    recent([
      rawTrack({ nowPlaying: true }),
      rawTrack({ name: 'Digital Love', playedAt: NOW - 3600000, loved: true }),
    ]),
  );
  const snapshot = {
    username: 'rj',
    fetchedAt: NOW,
    playing: true,
    current,
    last: tracks[1],
    tracks,
    today: 12,
    total,
  };
  const entries = [
    readTrack({ name: 'Discovery', artist: { name: 'Daft Punk' }, playcount: '1234' }),
  ];
  for (const language of LANGUAGES) {
    for (const content of [
      buildNowPlayingWidget({ snapshot, language, canLove: true, now: NOW }),
      buildNowPlayingWidget({
        snapshot: { ...snapshot, playing: false, current: null },
        language,
        canLove: false,
        now: NOW,
      }),
      buildRecentTracksWidget({ snapshot, language, settings: { count: 8 } }),
      ...['artists', 'albums', 'tracks'].map((kind) =>
        buildTopWidget({ username: 'rj', entries, kind, period: '12month', language }),
      ),
    ]) {
      assert.deepEqual(validateWidgetContent(content), [], language);
    }
  }
});

test('device names and scene texts follow the language', () => {
  assert.equal(buildDevice(fakeGladys, 'rj', 'de').features[0].name, 'Hört gerade');
  assert.equal(buildDevice(fakeGladys, 'rj', 'es').features[0].name, 'Escuchando');
  const snapshot = { username: 'rj', playing: false, current: null, last: null, tracks: [] };
  assert.equal(buildNowPlayingOutputs(snapshot, 'de').summary, 'rj hat noch keinen Titel.');
  const stats = buildStatsOutputs({
    snapshot: { ...snapshot, today: 3, total: 10 },
    topArtist: null,
    topAlbum: null,
    topTrack: null,
    period: '7day',
    language: 'es',
  });
  assert.match(stats.summary, /últimos 7 días/);
  // Unknown language: English.
  assert.equal(t('featurePlaying', 'it'), 'Listening');
});

test('docs: English and French mandatory, the four languages with the same structure', () => {
  const headings = (text) => text.split('\n').filter((line) => /^#{1,3} /.test(line)).length;
  const tables = (text) => text.split('\n').filter((line) => /^\|\s*-/.test(line)).length;
  const docs = Object.fromEntries(
    LANGUAGES.map((language) => {
      const path = new URL(`../docs/${language}.md`, import.meta.url);
      assert.ok(existsSync(path), `docs/${language}.md is missing`);
      return [language, readFileSync(path, 'utf8')];
    }),
  );
  for (const language of LANGUAGES) {
    assert.ok(docs[language].length > 300, `docs/${language}.md is too short`);
    assert.equal(headings(docs[language]), headings(docs.en), `docs/${language}.md headings`);
    assert.equal(tables(docs[language]), tables(docs.en), `docs/${language}.md tables`);
  }
});

test('README: one per language, each linking to the three others', () => {
  const files = { en: 'README.md', fr: 'README.fr.md', de: 'README.de.md', es: 'README.es.md' };
  for (const file of Object.values(files)) {
    const path = new URL(`../${file}`, import.meta.url);
    assert.ok(existsSync(path), `${file} is missing`);
    const text = readFileSync(path, 'utf8');
    for (const other of Object.values(files).filter((name) => name !== file)) {
      assert.ok(text.includes(`](${other})`), `${file} does not link to ${other}`);
    }
  }
});
