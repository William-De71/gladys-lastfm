// -----------------------------------------------------------------------------
// Reading the Last.fm answers.
//
// The JSON of the API is a mechanical translation of its XML, with the usual
// scars:
//   - a list of ONE element comes as an object, not an array;
//   - every value is a string ("0", "1", "1696000000");
//   - the text of an element is under '#text' (`album['#text']`), its
//     attributes under '@attr' (`@attr.nowplaying`);
//   - the artist is `{ '#text' }` in a plain answer, `{ name }` with
//     `extended=1`.
// Everything is flattened here into plain objects, so the rest of the code
// never sees those shapes.
// -----------------------------------------------------------------------------

import { largestImage } from './images.js';

/**
 * @description Make a list of a Last.fm "list" (object when single).
 * @param {unknown} value - The value.
 * @returns {Array} The list.
 * @example
 * asArray({ name: 'a' }); // -> [{ name: 'a' }]
 */
function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value && typeof value === 'object' ? [value] : [];
}

/**
 * @description Read the text of a Last.fm value: a string, `{ '#text' }` or `{ name }`.
 * @param {unknown} value - The value.
 * @returns {string} The text, '' when absent.
 * @example
 * textOf({ '#text': 'Daft Punk' }); // -> 'Daft Punk'
 */
function textOf(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    return textOf(value.name ?? value['#text'] ?? '');
  }
  return '';
}

/**
 * @description Read a non-negative integer sent as a string.
 * @param {unknown} value - The value.
 * @returns {number|null} The integer, null when unreadable.
 * @example
 * readCount('1234'); // -> 1234
 */
function readCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

/**
 * @description Flatten one track (recent, loved or top).
 * @param {object} raw - The raw track.
 * @returns {{ artist: string, name: string, album: string, url: string,
 * image: string|null, nowPlaying: boolean, playedAt: number|null,
 * loved: boolean|null, playcount: number|null }} The track (playedAt in ms).
 * @example
 * readTrack({ name: 'One More Time', artist: { '#text': 'Daft Punk' } });
 */
function readTrack(raw) {
  const uts = readCount(raw?.date?.uts);
  return {
    artist: textOf(raw?.artist),
    name: textOf(raw?.name),
    album: textOf(raw?.album),
    url: typeof raw?.url === 'string' ? raw.url : '',
    image: largestImage(raw?.image),
    nowPlaying: raw?.['@attr']?.nowplaying === 'true',
    playedAt: uts === null ? null : uts * 1000,
    loved: raw?.loved === undefined ? null : String(raw.loved) === '1',
    playcount: readCount(raw?.playcount),
  };
}

/**
 * @description Read a `recenttracks` answer.
 * @param {object} recent - The `recenttracks` object.
 * @returns {{ tracks: object[], current: object|null, total: number|null }}
 * The tracks (newest first), the one playing now, and the scrobble count of
 * the requested range (the track playing now is not a scrobble yet).
 * @example
 * readRecentTracks(body.recenttracks);
 */
function readRecentTracks(recent) {
  const tracks = asArray(recent?.track)
    .map(readTrack)
    .filter((track) => track.artist && track.name);
  return {
    tracks,
    current: tracks.find((track) => track.nowPlaying) ?? null,
    total: readCount(recent?.['@attr']?.total),
  };
}

/**
 * @description Identity of a track, to tell "a new track" from "the same one".
 * @param {object|null} track - The track.
 * @returns {string} The key, '' for no track.
 * @example
 * trackKey({ artist: 'Daft Punk', name: 'One More Time', album: 'Discovery' });
 */
function trackKey(track) {
  if (!track) {
    return '';
  }
  return [track.artist, track.name, track.album].map((part) => part.toLowerCase()).join('\u0000');
}

/**
 * @description "Artist – Track", the way a track is named in one line.
 * @param {object|null} track - The track.
 * @returns {string} The label, '' for no track.
 * @example
 * trackLabel({ artist: 'Daft Punk', name: 'One More Time' }); // -> 'Daft Punk – One More Time'
 */
function trackLabel(track) {
  return track ? `${track.artist} – ${track.name}` : '';
}

/**
 * @description Read a profile (`user.getInfo`).
 * @param {object} user - The raw `user` object.
 * @returns {{ name: string, realname: string, url: string, playcount: number|null,
 * image: string|null }} The profile.
 * @example
 * readUser(body.user);
 */
function readUser(user) {
  return {
    name: textOf(user?.name),
    realname: textOf(user?.realname),
    url: typeof user?.url === 'string' ? user.url : '',
    playcount: readCount(user?.playcount),
    image: largestImage(user?.image),
  };
}

export { asArray, textOf, readCount, readTrack, readRecentTracks, readUser, trackKey, trackLabel };
