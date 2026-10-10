// -----------------------------------------------------------------------------
// Scene events of the integration.
//
// The tracker says what happened; this module writes the flat `data` of the
// event the core matches against the scene triggers. Every trigger carries:
//   - `user`       the device external id of the profile: the value of the
//                  "Profile" filter (a `source: "devices"` select);
//   - `user_name`  the username, readable by the actions;
// plus the track (artist, track, album, url) and a ready-to-send `summary`.
// The "Artist" filter compares the artist exactly as Last.fm spells it.
// -----------------------------------------------------------------------------

import { SCENE_TRIGGERS } from './tracker.js';
import { idsOf } from './device.js';
import { t } from './i18n.js';
import { trackLabel } from './tracks.js';

const MAX_TEXT = 1000;

const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);

/**
 * @description Build the data of a scene event.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} username - The username.
 * @param {object} event - A tracker event `{ key, track, durationMs?, tracks? }`.
 * @param {string} language - Language of the summary.
 * @returns {{ key: string, data: object }} The event.
 * @example
 * const { key, data } = buildSceneEvent(gladys, 'rj', event, 'fr');
 * await gladys.publishSceneEvent(key, data);
 */
function buildSceneEvent(gladys, username, event, language) {
  const track = event.track ?? null;
  const data = {
    user: idsOf(gladys, username).device,
    user_name: username,
    artist: clip(track?.artist),
    track: clip(track?.name),
  };
  const values = { user: username, track: trackLabel(track) };
  switch (event.key) {
    case SCENE_TRIGGERS.TRACK_STARTED:
      Object.assign(data, {
        album: clip(track?.album),
        loved: track?.loved === true,
        url: clip(track?.url),
        summary: clip(t('summaryTrackStarted', language, values)),
      });
      break;
    case SCENE_TRIGGERS.LISTENING_STARTED:
      data.summary = clip(t('summaryListeningStarted', language, values));
      break;
    case SCENE_TRIGGERS.LISTENING_STOPPED: {
      const minutes = Math.round((event.durationMs ?? 0) / 60000);
      Object.assign(data, {
        duration_minutes: minutes,
        tracks_played: event.tracks ?? 0,
        summary: clip(
          t('summaryListeningStopped', language, { ...values, minutes, count: event.tracks ?? 0 }),
        ),
      });
      break;
    }
    case SCENE_TRIGGERS.TRACK_LOVED:
      Object.assign(data, {
        url: clip(track?.url),
        summary: clip(t('summaryLoved', language, values)),
      });
      break;
    default:
      break;
  }
  return { key: event.key, data };
}

export { buildSceneEvent };
