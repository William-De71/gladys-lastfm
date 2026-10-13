// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The profile, artists, albums and tracks are made up, and so are the
// covers: abstract SVG artworks drawn here from a seed, served under the
// image keys the widgets refer to (no real album art).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildNowPlayingWidget, buildRecentTracksWidget, buildTopWidget } =
  await load('src/widgets.js');
const { readTrack, readRecentTracks } = await load('src/tracks.js');
const { imageKeyFromUrl } = await load('src/images.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// A Tuesday evening: 13 October 2026, 21:14 in Paris.
const NOW = Date.parse('2026-10-13T19:14:00Z');
const MINUTE = 60000;
const USER = 'nina_vinyl';

// A cover: a Last.fm-shaped URL whose hash is derived from the album.
const hash = (value) => createHash('md5').update(value).digest('hex');
const coverUrl = (album) => `https://lastfm.freetls.fastly.net/i/u/300x300/${hash(album)}.jpg`;
const PALETTES = [
  ['#ff6b6b', '#feca57', '#1e272e'],
  ['#48dbfb', '#0abde3', '#222f3e'],
  ['#1dd1a1', '#10ac84', '#f5f6fa'],
  ['#5f27cd', '#ff9ff3', '#341f97'],
  ['#ff9f43', '#ee5253', '#2d3436'],
  ['#c8d6e5', '#576574', '#feca57'],
  ['#00d2d3', '#54a0ff', '#2e86de'],
  ['#f368e0', '#ff6b6b', '#2f3542'],
];
const artwork = (seed) => {
  const n = parseInt(hash(seed).slice(0, 8), 16);
  const [a, b, c] = PALETTES[n % PALETTES.length];
  const x = 60 + (n % 180);
  const y = 60 + ((n >> 8) % 180);
  const r = 50 + ((n >> 16) % 70);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="300" height="300" fill="url(#g)"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.85"/>` +
    `<rect x="0" y="${200 + (n % 60)}" width="300" height="14" fill="${c}" opacity="0.5"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

// The answers of the Last.fm API, as the watcher reads them.
const raw = (artist, name, album, { at, nowPlaying = false, loved = false } = {}) => ({
  artist: { '#text': artist },
  name,
  album: { '#text': album },
  url: `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(name)}`,
  image: [{ size: 'extralarge', '#text': coverUrl(album) }],
  loved: loved ? '1' : '0',
  ...(nowPlaying ? { '@attr': { nowplaying: 'true' } } : { date: { uts: String(at / 1000) } }),
});
const ago = (minutes) => NOW - minutes * MINUTE;
const recent = readRecentTracks({
  '@attr': { total: '48213' },
  track: [
    raw('The Velvet Harbour', 'Neon Tide', 'Saltwater Radio', { nowPlaying: true }),
    raw('Mira Solenne', 'Paper Lanterns', 'Quiet Satellites', { at: ago(4), loved: true }),
    raw('Northbound Static', 'Glass Highway', 'Low Light Atlas', { at: ago(8) }),
    raw('Los Faros Lentos', 'Verano en Marte', 'Costa Infinita', { at: ago(13) }),
    raw('The Velvet Harbour', 'Undertow', 'Saltwater Radio', { at: ago(17), loved: true }),
  ],
});
const snapshot = {
  username: USER,
  playing: true,
  current: recent.current,
  last: recent.tracks.find((track) => !track.nowPlaying),
  tracks: recent.tracks,
  today: 37,
  total: recent.total,
};

const topAlbum = (artist, name, playcount) =>
  readTrack({
    artist: { name: artist },
    name,
    url: `https://www.last.fm/music/${encodeURIComponent(artist)}/${encodeURIComponent(name)}`,
    image: [{ size: 'extralarge', '#text': coverUrl(name) }],
    playcount: String(playcount),
  });
const TOP = [
  topAlbum('The Velvet Harbour', 'Saltwater Radio', 212),
  topAlbum('Mira Solenne', 'Quiet Satellites', 164),
  topAlbum('Northbound Static', 'Low Light Atlas', 131),
  topAlbum('Kasimir & die Wolken', 'Sonntagsfieber', 97),
  topAlbum('Los Faros Lentos', 'Costa Infinita', 85),
  topAlbum('Odile Marchand', 'Cartes postales', 62),
];

// The image keys the contents refer to -> their artwork.
const images = {};
for (const album of [...recent.tracks.map((track) => track.album), ...TOP.map((e) => e.name)]) {
  images[imageKeyFromUrl(coverUrl(album))] = artwork(album);
}

const widgets = Object.fromEntries(manifest.widgets.map((w) => [w.key, w]));
const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    now_playing: buildNowPlayingWidget({ snapshot, language, canLove: true, now: NOW }),
    recent_tracks: buildRecentTracksWidget({ snapshot, language, settings: { count: 5 } }),
    top_charts: buildTopWidget({
      username: USER,
      entries: TOP,
      kind: 'albums',
      period: '1month',
      language,
    }),
  };
}
const cards = Object.fromEntries(
  Object.keys(contents.en).map((key) => [
    key,
    { icon: widgets[key].icon, label: widgets[key].label },
  ]),
);
writeFileSync(out, JSON.stringify({ now: NOW, cards, images, contents }, null, 1));
console.log('ok', Object.keys(contents.en).join(', '));
