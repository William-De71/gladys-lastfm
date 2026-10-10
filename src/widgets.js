// -----------------------------------------------------------------------------
// Dashboard widgets of the Last.fm integration.
//
//   - `now_playing`    the track playing now (or the last one): cover,
//                      title, artist and album, today's and total scrobbles,
//                      a "Love" button when the profile is the linked account,
//                      a link to the track on Last.fm. Nudged on every track
//                      change, so a wall tablet follows the music;
//   - `recent_tracks`  the latest scrobbles as a list with their covers, the
//                      track playing now and the loved ones badged;
//   - `top_charts`     top artists, albums or tracks over a period, albums as
//                      a cover grid.
//
// Each widget instance picks a profile among the devices of the integration
// (`source: "devices"`); empty = the first followed profile.
// -----------------------------------------------------------------------------

import { t, ago } from './i18n.js';
import { imageKeyFromUrl } from './images.js';

const WIDGETS = {
  NOW_PLAYING: 'now_playing',
  RECENT_TRACKS: 'recent_tracks',
  TOP_CHARTS: 'top_charts',
};

const WIDGET_ACTIONS = { LOVE: 'love', UNLOVE: 'unlove' };

const TTL_SECONDS = {
  playing: 30,
  stopped: 120,
  recent: 60,
  top: 1800,
  message: 300,
};

const TOP_KINDS = ['artists', 'albums', 'tracks'];
const TOP_PERIODS = ['7day', '1month', '3month', '6month', '12month', 'overall'];
const RECENT_COUNT = { min: 1, max: 8, default: 5 };
const TOP_COUNT = { min: 1, max: 12, default: 6 };
const MAX_LIST_ITEMS = 8;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('A very long title', 10); // -> 'A very lo…'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description Read a bounded integer setting.
 * @param {unknown} raw - The raw setting.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 */
function readCount(raw, bounds) {
  const value = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

const httpsLink = (url) => (typeof url === 'string' && url.startsWith('https://') ? url : null);

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 * @example
 * messageContent('No profile');
 */
function messageContent(message, ttl = TTL_SECONDS.message) {
  return { ttl_seconds: ttl, components: [{ type: 'text', variant: 'body', text: message }] };
}

/**
 * @description The "now playing" widget.
 * @param {object} options - Options.
 * @param {object} options.snapshot - The snapshot of the profile.
 * @param {string} options.language - The user language.
 * @param {boolean} options.canLove - Whether the profile is the linked account.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 * @example
 * buildNowPlayingWidget({ snapshot, language: 'fr', canLove: true, now: Date.now() });
 */
function buildNowPlayingWidget({ snapshot, language, canLove, now }) {
  const track = snapshot.current ?? snapshot.last;
  if (!track) {
    return messageContent(t('nothingYet', language, { user: snapshot.username }));
  }
  const components = [];
  const image = imageKeyFromUrl(track.image);
  if (image) {
    components.push({
      type: 'image',
      key: image,
      alt: clip(track.album || track.name, 100),
      fit: 'contain',
    });
  }
  components.push({ type: 'text', variant: 'heading', text: clip(track.name, 40) });
  components.push({
    type: 'text',
    variant: 'caption',
    text: clip([track.artist, track.album].filter(Boolean).join(' · '), 80),
  });
  if (Number.isInteger(snapshot.today)) {
    components.push({
      type: 'value',
      value: snapshot.today,
      label: t('today', language),
      icon: 'music',
      color: 'primary',
    });
  }
  if (Number.isInteger(snapshot.total)) {
    components.push({
      type: 'value',
      value: snapshot.total,
      label: t('total', language),
      icon: 'bar-chart-2',
    });
  }
  const items = [
    {
      label: t('status', language),
      value: t(snapshot.playing ? 'listening' : 'stopped', language),
      color: snapshot.playing ? 'success' : 'neutral',
    },
  ];
  if (!snapshot.playing && Number.isFinite(track.playedAt)) {
    items.push({ label: t('lastPlayed', language), value: ago(track.playedAt, now, language) });
  }
  if (track.loved) {
    items.push({ label: t('loved', language), value: t('yes', language), color: 'danger' });
  }
  components.push({ type: 'status', items });
  if (canLove) {
    components.push({
      type: 'button',
      label: t(track.loved ? 'unlove' : 'love', language),
      icon: 'heart',
      style: track.loved ? 'secondary' : 'primary',
      action: {
        key: track.loved ? WIDGET_ACTIONS.UNLOVE : WIDGET_ACTIONS.LOVE,
        params: { artist: track.artist, track: track.name },
      },
    });
  }
  const link = httpsLink(track.url);
  if (link) {
    components.push({
      type: 'button',
      label: t('openLastfm', language),
      icon: 'external-link',
      style: 'secondary',
      link: { url: link },
    });
  }
  return {
    ttl_seconds: snapshot.playing ? TTL_SECONDS.playing : TTL_SECONDS.stopped,
    components,
  };
}

/**
 * @description The "recent tracks" widget.
 * @param {object} options - Options.
 * @param {object} options.snapshot - The snapshot of the profile.
 * @param {string} options.language - The user language.
 * @param {object} [options.settings] - `{ count }`.
 * @returns {object} The content.
 * @example
 * buildRecentTracksWidget({ snapshot, language: 'en', settings: { count: 5 } });
 */
function buildRecentTracksWidget({ snapshot, language, settings = {} }) {
  const count = readCount(settings.count, RECENT_COUNT);
  const tracks = snapshot.tracks.slice(0, count);
  if (tracks.length === 0) {
    return messageContent(t('nothingYet', language, { user: snapshot.username }));
  }
  const items = tracks.map((track) => {
    const item = { title: clip(track.name, 60), subtitle: clip(track.artist, 60) };
    if (!track.nowPlaying && Number.isFinite(track.playedAt)) {
      item.date = new Date(track.playedAt).toISOString();
    }
    const image = imageKeyFromUrl(track.image);
    if (image) {
      item.image = image;
    }
    if (track.nowPlaying) {
      item.badge = { text: t('nowBadge', language), color: 'success' };
    } else if (track.loved) {
      item.badge = { text: t('lovedBadge', language), color: 'danger' };
    }
    if (track.album) {
      item.description = clip(track.album, 2000);
    }
    const link = httpsLink(track.url);
    if (link) {
      item.links = [{ url: link, label: 'Last.fm' }];
    }
    return item;
  });
  return {
    ttl_seconds: TTL_SECONDS.recent,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('recentOf', language, { user: snapshot.username }), 80),
      },
      { type: 'card-list', display: 'list', items },
    ],
  };
}

/**
 * @description Read the settings of the "top charts" widget.
 * @param {object} [settings] - The raw settings.
 * @returns {{ kind: string, period: string, count: number }} The settings.
 * @example
 * readTopSettings({ kind: 'albums' }); // -> { kind: 'albums', period: '7day', count: 6 }
 */
function readTopSettings(settings = {}) {
  const kind = TOP_KINDS.includes(settings.kind) ? settings.kind : TOP_KINDS[0];
  const period = TOP_PERIODS.includes(settings.period) ? settings.period : TOP_PERIODS[0];
  const count = Math.min(
    readCount(settings.count, TOP_COUNT),
    kind === 'albums' ? TOP_COUNT.max : MAX_LIST_ITEMS,
  );
  return { kind, period, count };
}

/**
 * @description The "top charts" widget.
 * @param {object} options - Options.
 * @param {string} options.username - The username.
 * @param {object[]} options.entries - The chart entries (read by readTrack), best first.
 * @param {string} options.kind - 'artists' | 'albums' | 'tracks'.
 * @param {string} options.period - The period.
 * @param {string} options.language - The user language.
 * @returns {object} The content.
 * @example
 * buildTopWidget({ username: 'rj', entries, kind: 'albums', period: '7day', language: 'en' });
 */
function buildTopWidget({ username, entries, kind, period, language }) {
  const kindLabel = {
    artists: t('topArtists', language),
    albums: t('topAlbums', language),
    tracks: t('topTracks', language),
  }[kind];
  const caption = {
    type: 'text',
    variant: 'caption',
    text: clip(
      t('topOf', language, {
        kind: kindLabel,
        user: username,
        period: t(`period_${period}`, language),
      }),
      80,
    ),
  };
  if (entries.length === 0) {
    return {
      ttl_seconds: TTL_SECONDS.top,
      components: [caption, { type: 'text', variant: 'body', text: t('emptyChart', language) }],
    };
  }
  const items = entries.map((entry, index) => {
    const item = { title: clip(`${index + 1}. ${entry.name}`, 60) };
    if (kind !== 'artists' && entry.artist) {
      item.subtitle = clip(entry.artist, 60);
    }
    const image = imageKeyFromUrl(entry.image);
    if (image) {
      item.image = image;
    }
    if (Number.isInteger(entry.playcount)) {
      item.badge = {
        text: clip(t('plays', language, { n: entry.playcount.toLocaleString(language) }), 16),
        color: 'primary',
      };
    }
    const link = httpsLink(entry.url);
    if (link) {
      item.links = [{ url: link, label: 'Last.fm' }];
    }
    return item;
  });
  return {
    ttl_seconds: TTL_SECONDS.top,
    components: [
      caption,
      { type: 'card-list', display: kind === 'albums' ? 'grid' : 'list', items },
    ],
  };
}

export {
  WIDGETS,
  WIDGET_ACTIONS,
  TTL_SECONDS,
  TOP_KINDS,
  TOP_PERIODS,
  RECENT_COUNT,
  TOP_COUNT,
  messageContent,
  readTopSettings,
  buildNowPlayingWidget,
  buildRecentTracksWidget,
  buildTopWidget,
};
