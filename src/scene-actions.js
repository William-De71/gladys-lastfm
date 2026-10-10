// -----------------------------------------------------------------------------
// Scene actions of the Last.fm integration.
//
//   - `get_now_playing`  what a profile is listening to (or listened to last);
//   - `get_stats`        today's and total scrobbles, and the top artist,
//                        album and track over a period;
//   - `love_track` / `unlove_track`  as the linked account: a given track, or
//                        when the fields are empty the one playing now (or
//                        the last one played).
// Each targets a profile through a `source: "devices"` select; empty = the
// first followed profile (the linked account for love/unlove).
// -----------------------------------------------------------------------------

import { t } from './i18n.js';
import { trackLabel } from './tracks.js';
import { formatDateTime } from './time.js';

const SCENE_ACTIONS = {
  GET_NOW_PLAYING: 'get_now_playing',
  GET_STATS: 'get_stats',
  LOVE_TRACK: 'love_track',
  UNLOVE_TRACK: 'unlove_track',
};

/**
 * @description Outputs of "get what is playing".
 * @param {object} snapshot - The snapshot of the profile.
 * @param {string} language - Language of the summary.
 * @returns {object} The outputs.
 * @example
 * buildNowPlayingOutputs(snapshot, 'fr');
 */
function buildNowPlayingOutputs(snapshot, language) {
  const track = snapshot.current ?? snapshot.last;
  const values = { user: snapshot.username, track: trackLabel(track) };
  let summary = t('summaryNothing', language, values);
  if (snapshot.playing && snapshot.current) {
    summary = t('summaryPlaying', language, values);
  } else if (track) {
    summary = t('summaryLast', language, values);
  }
  return {
    user_name: snapshot.username,
    playing: Boolean(snapshot.playing && snapshot.current),
    artist: track?.artist ?? '',
    track: track?.name ?? '',
    album: track?.album ?? '',
    loved: track?.loved === true,
    url: track?.url ?? '',
    played_at: Number.isFinite(track?.playedAt) ? formatDateTime(track.playedAt, language) : '',
    summary,
  };
}

/**
 * @description Outputs of "get the listening statistics".
 * @param {object} options - Options.
 * @param {object} options.snapshot - The snapshot of the profile.
 * @param {object|null} options.topArtist - The top artist (read by readTrack).
 * @param {object|null} options.topAlbum - The top album.
 * @param {object|null} options.topTrack - The top track.
 * @param {string} options.period - The period.
 * @param {string} options.language - Language of the summary.
 * @returns {object} The outputs.
 * @example
 * buildStatsOutputs({ snapshot, topArtist, topAlbum, topTrack, period: '7day', language: 'en' });
 */
function buildStatsOutputs({ snapshot, topArtist, topAlbum, topTrack, period, language }) {
  const outputs = {
    user_name: snapshot.username,
    scrobbles_today: Number.isInteger(snapshot.today) ? snapshot.today : null,
    scrobbles_total: Number.isInteger(snapshot.total) ? snapshot.total : null,
    top_artist: topArtist?.name ?? '',
    top_artist_plays: topArtist?.playcount ?? null,
    top_album: topAlbum ? `${topAlbum.artist} – ${topAlbum.name}` : '',
    top_track: topTrack ? trackLabel({ artist: topTrack.artist, name: topTrack.name }) : '',
  };
  outputs.summary = t('summaryStats', language, {
    user: snapshot.username,
    today: outputs.scrobbles_today ?? '?',
    total: outputs.scrobbles_total ?? '?',
    period: t(`period_${period}`, language),
    artist: outputs.top_artist || '–',
  });
  return outputs;
}

/**
 * @description The track a love/unlove action targets.
 * @param {object} fields - The action fields `{ artist, track }`.
 * @param {object|null} snapshot - The snapshot of the linked account.
 * @returns {{ artist: string, track: string }|null} The track, null when
 * neither the fields nor the profile give one.
 * @example
 * loveTarget({ artist: '', track: '' }, snapshot);
 */
function loveTarget(fields, snapshot) {
  const artist = typeof fields?.artist === 'string' ? fields.artist.trim() : '';
  const track = typeof fields?.track === 'string' ? fields.track.trim() : '';
  if (artist && track) {
    return { artist, track };
  }
  const current = snapshot?.current ?? snapshot?.last;
  return current ? { artist: current.artist, track: current.name } : null;
}

export { SCENE_ACTIONS, buildNowPlayingOutputs, buildStatsOutputs, loveTarget };
