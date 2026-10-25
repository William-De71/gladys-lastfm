// -----------------------------------------------------------------------------
// The "Last.fm – <user>" devices.
//
// One device per followed profile, offered on the Discovery screen. It brings
// what only the core offers: the history of the listening (chart box), the
// dashboard device box, and scenes on a value ("more than 100 scrobbles
// today", "listening → dim the lights").
//
// Features, all read-only:
//   - `playing`      music / playback_state: 1 while a track is playing;
//   - `now_playing`  text: "Artist – Track", the track playing now, or the
//                    last one played (never emptied: "what was that song?");
//   - `today`        counter: scrobbles since midnight (Gladys time zone);
//   - `total`        counter: scrobbles since the account was created;
//   - `music_title`, `music_artist`, `music_album`, `music_artwork`: the
//                    now playing of the `music` types of Gladys 5.3.0 (title,
//                    artist, album, cover key), added after 1.1.1 under new
//                    keys and published through publishNowPlaying. Empty
//                    when nothing is playing (unlike `now_playing`). No
//                    duration nor position: user.getRecentTracks gives
//                    neither, and a Last.fm profile is not a player (no
//                    command), so the dashboard music box does not offer it.
//
// The external id is built on the lowercased username (Last.fm usernames are
// case-insensitive): "RJ" and "rj" are the same device.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';
import { trackLabel } from './tracks.js';
import { imageKeyFromUrl } from './images.js';

const DEVICE_TYPE = 'user';
const FEATURE_KEYS = {
  PLAYING: 'playing',
  NOW_PLAYING: 'now_playing',
  TODAY: 'today',
  TOTAL: 'total',
  MUSIC_TITLE: 'music_title',
  MUSIC_ARTIST: 'music_artist',
  MUSIC_ALBUM: 'music_album',
  MUSIC_ARTWORK: 'music_artwork',
};
// The music feature types publishNowPlaying fills, by feature key.
const MUSIC_FEATURES = [
  [FEATURE_KEYS.MUSIC_TITLE, DEVICE_FEATURE_TYPES.MUSIC.TITLE, 'featureMusicTitle'],
  [FEATURE_KEYS.MUSIC_ARTIST, DEVICE_FEATURE_TYPES.MUSIC.ARTIST, 'featureMusicArtist'],
  [FEATURE_KEYS.MUSIC_ALBUM, DEVICE_FEATURE_TYPES.MUSIC.ALBUM, 'featureMusicAlbum'],
  [FEATURE_KEYS.MUSIC_ARTWORK, DEVICE_FEATURE_TYPES.MUSIC.ARTWORK, 'featureMusicArtwork'],
];
const PLAYBACK_STATE = { PLAYING: 1, STOPPED: 0 };
// Bounds of the counters: far beyond any real account (a scrobble every three
// minutes, day and night, for a century is about 17 million).
const MAX_TODAY = 2000;
const MAX_TOTAL = 100000000;

/**
 * @description The external ids of a profile.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} username - The username.
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, 'RJ').device; // -> 'ext:lastfm:user:rj'
 */
function idsOf(gladys, username) {
  return gladys.externalIds(DEVICE_TYPE, username.toLowerCase());
}

/**
 * @description The username a device external id stands for.
 * @param {string} externalId - A device (or feature) external id.
 * @param {string[]} usernames - The configured usernames.
 * @returns {string|null} The configured username, null when not followed any more.
 * @example
 * usernameFromExternalId('ext:lastfm:user:rj', ['RJ']); // -> 'RJ'
 */
function usernameFromExternalId(externalId, usernames) {
  const match = /:user:([a-z0-9_-]+)(?::[a-z_]+)?$/.exec(String(externalId ?? ''));
  if (!match) {
    return null;
  }
  return usernames.find((name) => name.toLowerCase() === match[1]) ?? null;
}

/**
 * @description A read-only feature.
 * @param {object} feature - Its fields.
 * @returns {object} The feature.
 */
function sensor(feature) {
  return { read_only: true, has_feedback: false, keep_history: true, ...feature };
}

/**
 * @description Build the device of a profile.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} username - The username (as Last.fm spells it).
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 * @example
 * await gladys.publishDiscoveredDevices([buildDevice(gladys, 'RJ', 'fr')]);
 */
function buildDevice(gladys, username, language = 'en') {
  const ids = idsOf(gladys, username);
  return {
    name: t('deviceName', language, { user: username }),
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'LASTFM_USER', value: username }],
    features: [
      sensor({
        name: t('featurePlaying', language),
        external_id: ids.feature(FEATURE_KEYS.PLAYING),
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.PLAYBACK_STATE,
        min: PLAYBACK_STATE.STOPPED,
        max: PLAYBACK_STATE.PLAYING,
      }),
      sensor({
        name: t('featureNowPlaying', language),
        external_id: ids.feature(FEATURE_KEYS.NOW_PLAYING),
        category: DEVICE_FEATURE_CATEGORIES.TEXT,
        type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
        keep_history: false,
        min: 0,
        max: 0,
      }),
      sensor({
        name: t('featureToday', language),
        external_id: ids.feature(FEATURE_KEYS.TODAY),
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        min: 0,
        max: MAX_TODAY,
      }),
      sensor({
        name: t('featureTotal', language),
        external_id: ids.feature(FEATURE_KEYS.TOTAL),
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        min: 0,
        max: MAX_TOTAL,
      }),
      // Never historized (the core forces it on the whole music category).
      ...MUSIC_FEATURES.map(([key, type, name]) =>
        sensor({
          name: t(name, language),
          external_id: ids.feature(key),
          category: DEVICE_FEATURE_CATEGORIES.MUSIC,
          type,
          keep_history: false,
          min: 0,
          max: 0,
        }),
      ),
    ],
  };
}

/**
 * @description The now playing of a profile, for gladys.publishNowPlaying:
 * the track playing now, every text emptied when nothing plays (an absent
 * key would mean "unchanged"). The cover is a Last.fm one only (the grey
 * star placeholder is no cover); the SDK turns its URL into an artwork key
 * and serves its bytes (300 × 300, a few dozen KB).
 * @param {object} snapshot - `{ playing, current }`.
 * @returns {{ title: string, artist: string, album: string, artwork_url: string|null }}
 * The now playing.
 * @example
 * await gladys.publishNowPlaying(ids.device, nowPlayingOf(snapshot), {
 *   featureExternalIds: nowPlayingFeatureIds(gladys, 'rj'),
 * });
 */
function nowPlayingOf(snapshot) {
  const track = snapshot?.playing ? snapshot.current : null;
  if (!track) {
    return { title: '', artist: '', album: '', artwork_url: null };
  }
  return {
    title: track.name,
    artist: track.artist,
    album: track.album,
    artwork_url: imageKeyFromUrl(track.image) ? track.image : null,
  };
}

/**
 * @description The feature external ids of the now playing, by music type
 * (the `music_*` keys, not the SDK default `<device>:<type>`). The playback
 * state stays the `playing` feature of 1.0.0, published by buildStates.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} username - The username.
 * @returns {object} type -> feature external id.
 * @example
 * nowPlayingFeatureIds(gladys, 'rj').title; // -> 'ext:lastfm:user:rj:music_title'
 */
function nowPlayingFeatureIds(gladys, username) {
  const ids = idsOf(gladys, username);
  return Object.fromEntries(MUSIC_FEATURES.map(([key, type]) => [type, ids.feature(key)]));
}

/**
 * @description The states of a profile. An unknown counter is omitted, never
 * published as 0 (a 0 would look like a reset in the history and fire the
 * "fewer than" scenes); no track ever played leaves the text untouched.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} username - The username.
 * @param {object} snapshot - `{ playing, current, last, today, total }`.
 * @returns {Array<object>} The states.
 * @example
 * await gladys.publishStates(buildStates(gladys, 'rj', snapshot));
 */
function buildStates(gladys, username, snapshot) {
  const ids = idsOf(gladys, username);
  const states = [
    {
      device_feature_external_id: ids.feature(FEATURE_KEYS.PLAYING),
      state: snapshot.playing ? PLAYBACK_STATE.PLAYING : PLAYBACK_STATE.STOPPED,
    },
  ];
  const track = snapshot.current ?? snapshot.last;
  if (track) {
    states.push({
      device_feature_external_id: ids.feature(FEATURE_KEYS.NOW_PLAYING),
      text: trackLabel(track),
    });
  }
  if (Number.isInteger(snapshot.today)) {
    states.push({
      device_feature_external_id: ids.feature(FEATURE_KEYS.TODAY),
      state: Math.min(snapshot.today, MAX_TODAY),
    });
  }
  if (Number.isInteger(snapshot.total)) {
    states.push({
      device_feature_external_id: ids.feature(FEATURE_KEYS.TOTAL),
      state: Math.min(snapshot.total, MAX_TOTAL),
    });
  }
  return states;
}

export {
  DEVICE_TYPE,
  FEATURE_KEYS,
  PLAYBACK_STATE,
  idsOf,
  usernameFromExternalId,
  buildDevice,
  buildStates,
  nowPlayingOf,
  nowPlayingFeatureIds,
};
