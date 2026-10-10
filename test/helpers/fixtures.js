// Shapes of the Last.fm answers (as the API sends them: strings everywhere,
// a single element as an object) and a stand-in for the SDK external ids.

export const NOW = Date.parse('2026-10-11T10:00:00Z');

export const COVER =
  'https://lastfm.freetls.fastly.net/i/u/300x300/0123456789abcdef0123456789abcdef.jpg';
export const STAR =
  'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';

/**
 * @description An `image` array of the API.
 * @param {string} url - The largest image.
 * @returns {Array} The array.
 */
export function images(url) {
  return [
    { size: 'small', '#text': url.replace('300x300', '34s') },
    { size: 'medium', '#text': url.replace('300x300', '64s') },
    { size: 'large', '#text': url.replace('300x300', '174s') },
    { size: 'extralarge', '#text': url },
  ];
}

/**
 * @description A raw recent track (extended=1).
 * @param {object} options - Options.
 * @returns {object} The raw track.
 */
export function rawTrack({
  artist = 'Daft Punk',
  name = 'One More Time',
  album = 'Discovery',
  playedAt = null,
  nowPlaying = false,
  loved = false,
  image = COVER,
} = {}) {
  const raw = {
    artist: { name: artist, url: `https://www.last.fm/music/${encodeURIComponent(artist)}` },
    name,
    album: { mbid: '', '#text': album },
    url: `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(name)}`,
    image: images(image),
    loved: loved ? '1' : '0',
    streamable: '0',
  };
  if (nowPlaying) {
    raw['@attr'] = { nowplaying: 'true' };
  }
  if (playedAt !== null) {
    raw.date = { uts: String(Math.floor(playedAt / 1000)), '#text': 'whatever' };
  }
  return raw;
}

/**
 * @description A `recenttracks` object.
 * @param {Array} tracks - The raw tracks.
 * @param {number} total - The `@attr.total`.
 * @returns {object} The object.
 */
export function recent(tracks, total = 1234) {
  return {
    track: tracks.length === 1 ? tracks[0] : tracks,
    '@attr': { user: 'rj', page: '1', perPage: '10', totalPages: '124', total: String(total) },
  };
}

/** A stand-in for the SDK, building the same external ids. */
export const fakeGladys = {
  externalIds(type, platformId) {
    const device = `ext:lastfm:${type}:${platformId}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

export const silent = { debug() {}, info() {}, warn() {}, error() {} };
